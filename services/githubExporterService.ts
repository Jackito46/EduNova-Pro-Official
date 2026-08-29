import fs from 'fs';
import path from 'path';

interface ExportProgressCallback {
  (step: string, percent: number): void;
}

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.cache',
  'temp_repo',
  '.temp_repo',
  '.local',
  '.config',
  '.npm'
]);

const EXCLUDE_EXTENSIONS = new Set([
  '.zip',
  '.tar.gz',
  '.tgz',
  '.log',
  '.map'
]);

function getAllFiles(dir: string, base: string = ''): { relPath: string; fullPath: string; isBinary: boolean; size: number }[] {
  let results: { relPath: string; fullPath: string; isBinary: boolean; size: number }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDE_EXTENSIONS.has(ext)) continue;
      
      // Exclude giant temporary files > 10MB
      const stat = fs.statSync(fullPath);
      if (stat.size > 15 * 1024 * 1024) continue;

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

  onProgress?.('Analyse des fichiers locaux...', 5);

  const localFiles = getAllFiles(process.cwd());
  if (localFiles.length === 0) {
    throw new Error('Aucun fichier à exporter trouvé dans le répertoire.');
  }

  // 1. Get reference commit
  onProgress?.(`Récupération de la branche "${branch}" sur ${owner}/${repo}...`, 10);
  let parentCommitSha: string | null = null;
  let baseTreeSha: string | null = null;

  try {
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
    if (refRes.ok) {
      const refData = await refRes.json();
      parentCommitSha = refData.object.sha;
      
      // Get commit object to extract base tree
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, { headers });
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        baseTreeSha = commitData.tree.sha;
      }
    }
  } catch (err) {
    console.warn('Could not fetch existing ref, creating new branch/commit if possible:', err);
  }

  // 2. Upload blobs for files
  onProgress?.(`Création des objets de fichiers (0/${localFiles.length})...`, 15);
  
  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];
  const BATCH_SIZE = 4;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function uploadBlobWithRetry(file: typeof localFiles[0], retries = 4): Promise<string> {
    let contentBase64: string;
    const fileBuffer = fs.readFileSync(file.fullPath);
    
    if (file.isBinary) {
      contentBase64 = fileBuffer.toString('base64');
    } else {
      let textContent = fileBuffer.toString('utf-8');
      // Sanitize any personal access token patterns to prevent GitHub Secret Scanning 422 block
      textContent = textContent.replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_TOKEN_PROTECTED');
      contentBase64 = Buffer.from(textContent, 'utf-8').toString('base64');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: contentBase64,
            encoding: 'base64'
          })
        });

        if (blobRes.ok) {
          const blobData = await blobRes.json();
          return blobData.sha;
        }

        const errText = await blobRes.text();
        // If secondary rate limit or 429, back off and retry
        if ((blobRes.status === 403 || blobRes.status === 429) && attempt < retries) {
          console.warn(`[GitHub Exporter] Rate limit hit for ${file.relPath}, waiting before retry (attempt ${attempt}/${retries})...`);
          await delay(2000 * attempt);
          continue;
        }

        throw new Error(`Échec de création du blob pour ${file.relPath}: ${errText}`);
      } catch (err: any) {
        if (attempt === retries) throw err;
        await delay(1500 * attempt);
      }
    }
    throw new Error(`Échec de création du blob pour ${file.relPath} après ${retries} tentatives.`);
  }
  
  for (let i = 0; i < localFiles.length; i += BATCH_SIZE) {
    const batch = localFiles.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(batch.map(async (file) => {
      const sha = await uploadBlobWithRetry(file);
      return {
        path: file.relPath,
        mode: '100644',
        type: 'blob',
        sha
      };
    }));

    treeItems.push(...results);

    // Small breathing pause between batches to respect GitHub secondary rate limits
    await delay(120);

    const percent = Math.min(85, 15 + Math.round(((i + batch.length) / localFiles.length) * 70));
    onProgress?.(`Transfert des fichiers (${Math.min(i + batch.length, localFiles.length)}/${localFiles.length})...`, percent);
  }

  // 3. Create Tree
  onProgress?.('Construction de l\'arborescence Git...', 88);
  const treeBody: any = {
    tree: treeItems
  };

  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify(treeBody)
  });

  if (!treeRes.ok) {
    const errText = await treeRes.text();
    throw new Error(`Erreur lors de la création de l'arbre Git: ${errText}`);
  }

  const treeData = await treeRes.json();

  // 4. Create Commit
  onProgress?.('Création du commit GitHub...', 92);
  const commitBody: any = {
    message: commitMessage,
    tree: treeData.sha,
    parents: parentCommitSha ? [parentCommitSha] : []
  };

  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify(commitBody)
  });

  if (!newCommitRes.ok) {
    const errText = await newCommitRes.text();
    throw new Error(`Erreur lors de la création du commit: ${errText}`);
  }

  const newCommitData = await newCommitRes.json();

  // 5. Update Ref
  onProgress?.('Mise à jour de la branche...', 96);
  const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: newCommitData.sha,
      force: true
    })
  });

  if (!updateRefRes.ok) {
    // Maybe branch ref doesn't exist yet, try creating it
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

  onProgress?.('Exportation terminée avec succès !', 100);

  return {
    success: true,
    commitSha: newCommitData.sha,
    filesCount: localFiles.length,
    repoUrl: `https://github.com/${owner}/${repo}`,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`
  };
}
