import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ExportProgressCallback {
  (step: string, percent: number): void;
}

const ALLOWED_ROOT_FILES = new Set([
  'App.tsx', 'index.tsx', 'index.html', 'index.css', 'types.ts', 'supabase.ts', 'server.ts',
  'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'Dockerfile',
  '.gitignore', '.npmrc', '.dockerignore', 'metadata.json', 'nginx.conf.template', 'render.yaml',
  'GUIDE_DEPLOIEMENT_VPS.md', 'GUIDE_TECHNIQUE_LOCAL.md', 'GUIDE_UTILISATEUR.md', 'README_LOCAL.md', 'README.md'
]);

const ALLOWED_DIRS = new Set([
  'components', 'contexts', 'hooks', 'lib', 'public', 'scripts', 'services', 'src', 'utils', 'sql'
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.cache', 'temp_repo', '.temp_repo', '.local', '.config', '.npm', 'app', 'data', 'backups', 'backup'
]);

const EXCLUDE_EXTENSIONS = new Set([
  '.zip', '.tar.gz', '.tgz', '.log', '.map', '.bak', '.tmp', '.patch'
]);

function computeGitBlobSha(buffer: Buffer): string {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, buffer])).digest('hex');
}

function getProjectFiles(dir: string, base: string = ''): { relPath: string; fullPath: string; isBinary: boolean; size: number }[] {
  let results: { relPath: string; fullPath: string; isBinary: boolean; size: number }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!base && !ALLOWED_DIRS.has(entry.name)) continue;
      results = results.concat(getProjectFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      if (!base && !ALLOWED_ROOT_FILES.has(entry.name)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDE_EXTENSIONS.has(ext)) continue;
      
      const stat = fs.statSync(fullPath);
      // Skip large temporary files (> 10MB)
      if (stat.size > 10 * 1024 * 1024) continue;

      const isBinary = [
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.wav', '.ogg'
      ].includes(ext);

      results.push({
        relPath: relPath.replace(/\\/g, '/'),
        fullPath,
        isBinary,
        size: stat.size
      });
    }
  }
  return results;
}

export async function exportProjectToGitHub(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main',
  commitMessage: string = 'Exportation automatique du projet depuis EduNova Pro',
  onProgress?: ExportProgressCallback
) {
  const headers = {
    'Authorization': `token ${token.trim()}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'EduNova-GitHub-Exporter'
  };

  onProgress?.('Analyse des fichiers du projet...', 5);

  const localFiles = getProjectFiles(process.cwd());
  if (localFiles.length === 0) {
    throw new Error('Aucun fichier à exporter trouvé dans le répertoire.');
  }

  // 1. Get reference commit and existing base tree
  onProgress?.(`Vérification de la branche "${branch}" sur GitHub...`, 10);
  let parentCommitSha: string | null = null;
  let parentTreeSha: string | null = null;
  const remoteTreeMap = new Map<string, string>();

  try {
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
    if (refRes.ok) {
      const refData = await refRes.json();
      parentCommitSha = refData.object?.sha || null;
      
      if (parentCommitSha) {
        // Fetch commit data to get parent tree sha
        const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, { headers });
        if (commitRes.ok) {
          const commitData = await commitRes.json();
          parentTreeSha = commitData.tree?.sha || null;
        }

        // Fetch remote tree recursively to enable zero-upload diffing
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${parentCommitSha}?recursive=1`, { headers });
        if (treeRes.ok) {
          const treeData = await treeRes.json();
          if (Array.isArray(treeData.tree)) {
            for (const item of treeData.tree) {
              if (item.type === 'blob' && item.path && item.sha) {
                remoteTreeMap.set(item.path, item.sha);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch existing remote ref:', err);
  }

  // 2. Identify which files actually changed
  onProgress?.('Calcul des deltas et empreintes Git...', 20);

  interface FileToUpload {
    relPath: string;
    contentBase64: string;
    sha: string;
  }

  const localFileMap = new Map<string, typeof localFiles[0]>();
  const filesToUpload: FileToUpload[] = [];
  const deltaTreeItems: { path: string; mode: string; type: string; sha: string | null }[] = [];

  for (const file of localFiles) {
    localFileMap.set(file.relPath, file);
    const fileBuffer = fs.readFileSync(file.fullPath);
    let finalBuffer: Buffer;

    if (file.isBinary) {
      finalBuffer = fileBuffer;
    } else {
      let textContent = fileBuffer.toString('utf-8');
      // Protect any accidental token pattern from GitHub Secret Scanning
      textContent = textContent.replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_TOKEN_PROTECTED');
      finalBuffer = Buffer.from(textContent, 'utf-8');
    }

    const localSha = computeGitBlobSha(finalBuffer);
    const remoteSha = remoteTreeMap.get(file.relPath);

    if (parentTreeSha && remoteSha === localSha) {
      // File is identical on GitHub, Git base_tree will retain it automatically
    } else {
      // File is new or modified
      filesToUpload.push({
        relPath: file.relPath,
        contentBase64: finalBuffer.toString('base64'),
        sha: localSha
      });
    }
  }

  // Detect deleted files when updating existing base_tree
  if (parentTreeSha) {
    for (const [remotePath] of remoteTreeMap) {
      if (!localFileMap.has(remotePath)) {
        deltaTreeItems.push({
          path: remotePath,
          mode: '100644',
          type: 'blob',
          sha: null // In Git Tree API, sha: null marks a file as deleted from base_tree
        });
      }
    }
  }

  // If nothing changed at all, return existing commit
  if (filesToUpload.length === 0 && deltaTreeItems.length === 0 && parentCommitSha) {
    onProgress?.('Tous les fichiers sont déjà à jour sur GitHub !', 100);
    return {
      success: true,
      commitSha: parentCommitSha,
      filesCount: localFiles.length,
      modifiedFilesCount: 0,
      repoUrl: `https://github.com/${owner}/${repo}`,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${parentCommitSha}`
    };
  }

  // 3. Upload modified/new files in concurrent batches
  if (filesToUpload.length > 0) {
    onProgress?.(`Transfert rapide des deltas (${filesToUpload.length} fichier(s) à synchroniser)...`, 30);

    const BATCH_SIZE = 6;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < filesToUpload.length; i += BATCH_SIZE) {
      const batch = filesToUpload.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(batch.map(async (file) => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                content: file.contentBase64,
                encoding: 'base64'
              })
            });

            if (blobRes.ok) {
              const blobData = await blobRes.json();
              return {
                path: file.relPath,
                mode: '100644',
                type: 'blob',
                sha: blobData.sha || file.sha
              };
            }

            const errText = await blobRes.text();
            if ((blobRes.status === 403 || blobRes.status === 429) && attempt < 3) {
              await delay(1500 * attempt);
              continue;
            }
            throw new Error(`Erreur blob pour ${file.relPath}: ${errText}`);
          } catch (err) {
            if (attempt === 3) throw err;
            await delay(1000 * attempt);
          }
        }
        return {
          path: file.relPath,
          mode: '100644',
          type: 'blob',
          sha: file.sha
        };
      }));

      deltaTreeItems.push(...batchResults);

      const percent = Math.min(85, 30 + Math.round(((i + batch.length) / filesToUpload.length) * 55));
      onProgress?.(`Envoi des sources (${Math.min(i + batch.length, filesToUpload.length)}/${filesToUpload.length})...`, percent);
    }
  }

  // 4. Build Tree Incrementally to prevent GitHub API 422 Timeouts
  onProgress?.('Construction de l\'arborescence Git...', 88);

  const TREE_CHUNK_SIZE = 50;
  let currentTreeSha = parentTreeSha;

  for (let i = 0; i < deltaTreeItems.length; i += TREE_CHUNK_SIZE) {
    const chunk = deltaTreeItems.slice(i, i + TREE_CHUNK_SIZE);
    const body: Record<string, any> = {
      tree: chunk
    };
    if (currentTreeSha) {
      body.base_tree = currentTreeSha;
    }

    const progressPercent = 88 + Math.round(((i + chunk.length) / deltaTreeItems.length) * 4);
    onProgress?.(`Arborescence Git (${Math.min(i + chunk.length, deltaTreeItems.length)}/${deltaTreeItems.length} éléments)...`, progressPercent);

    let treeRes: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (treeRes.ok) break;

      if ((treeRes.status === 403 || treeRes.status === 429 || treeRes.status === 422) && attempt < 3) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
    }

    if (!treeRes || !treeRes.ok) {
      const errText = treeRes ? await treeRes.text() : 'Pas de réponse du serveur GitHub';
      throw new Error(`Erreur lors de la création de l'arbre Git: ${errText}`);
    }

    const treeData = await treeRes.json();
    currentTreeSha = treeData.sha;
  }

  if (!currentTreeSha) {
    throw new Error("Impossible d'obtenir l'empreinte de l'arbre Git.");
  }

  // 5. Create Commit
  onProgress?.('Création du commit GitHub...', 94);
  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: commitMessage,
      tree: currentTreeSha,
      parents: parentCommitSha ? [parentCommitSha] : []
    })
  });

  if (!newCommitRes.ok) {
    const errText = await newCommitRes.text();
    throw new Error(`Erreur lors de la création du commit: ${errText}`);
  }

  const newCommitData = await newCommitRes.json();

  // 6. Update Branch Ref
  onProgress?.('Finalisation de la branche...', 97);
  const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: newCommitData.sha,
      force: true
    })
  });

  if (!updateRefRes.ok) {
    const createRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: newCommitData.sha
      })
    });

    if (!createRefRes.ok) {
      const errText = await createRefRes.text();
      throw new Error(`Erreur lors de la mise à jour de la branche: ${errText}`);
    }
  }

  onProgress?.('Exportation GitHub réussie !', 100);

  return {
    success: true,
    commitSha: newCommitData.sha,
    filesCount: localFiles.length,
    modifiedFilesCount: filesToUpload.length,
    repoUrl: `https://github.com/${owner}/${repo}`,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`
  };
}
