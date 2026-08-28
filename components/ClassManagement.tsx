import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Layers,
  GraduationCap,
  Users,
  ChevronRight,
  ChevronDown,
  Search,
  Edit2,
  Trash2,
  Hash,
  Filter,
  X,
  SearchCode,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  CheckCircle2,
  Bookmark,
  UserCheck,
  Building2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Send,
  ArrowLeftRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase, isValidUuid } from "../supabase";
import { useSchool } from "../contexts/SchoolContext";
import {
  SchoolLevel,
  SchoolClass,
  Subject,
  ClassSubject,
  UserProfile,
  UserRole,
} from "../types";
import { AuditLogger } from "../utils/auditLogger";

const getSubjectCodesForDiscipline = (disciplineName: string): string[] => {
  const norm = disciplineName.toUpperCase();
  if (norm.includes("DENTAIRE")) {
    return [
      "ANAT-DENT", "HISTO-EMBRYO", "BIOCH-MED", "PHYSIO-GEN", "ODONT-CONS1",
      "PROTH-DENT1", "PARO1", "RADIO-BUCCAL", "PATH-MED-CHIR", "ODONT-CONS2",
      "PROTH-DENT2", "PHARMACO-DENT", "CHIR-BUCC", "ODF", "THERAP-ENDO",
      "DENT-PEDIAT", "CLIN-ODONT", "URG-DENT", "STAGE-HOSP-DENT", "PROJ-GRAD-DENT",
      "COM-FR", "ANG-ACAD", "MATH-GEN", "METHOD-RECH"
    ];
  }
  if (norm.includes("INFORMATIQUE") || norm.includes("SOFTWARE") || norm.includes("COMPUTER")) {
    return [
      "ALGO101", "MATH-DISC", "ARCHI-ORD", "INTRO-INFO", "PROG-OOP",
      "DBD201", "RESEAUX1", "STRUC-DAT", "PROG-WEB", "ING-LOG",
      "SEC-INF", "SYS-EXPLOIT", "IA-INTRO", "CLOUD-ARCH",
      "COM-FR", "ANG-ACAD", "MATH-GEN", "METHOD-RECH"
    ];
  }
  if (norm.includes("INFIRMI") || norm.includes("SOINS")) {
    return [
      "ANATOMIE1", "ANATOMIE2", "NUTRITION", "SOINS-FOND", "MICRO-PARASIT",
      "PATHOLOGIE1", "SOINS-ADULTE", "PHARMACO1", "ETHIQUE-DEONT", "SOINS-PEDIAT",
      "SOINS-MATERN", "SANTE-COMM", "SOINS-PSYCH", "GEST-SOINS", "RECH-INF",
      "STAGE-INTEG", "COM-FR", "ANG-ACAD", "MATH-GEN", "METHOD-RECH"
    ];
  }
  if (norm.includes("GÉNÉRALE") || norm.includes("GENERALE") || norm.includes("MÉDECINE") || norm.includes("MEDECINE")) {
    return [
      "ANATOMIE1", "ANATOMIE2", "PATHOLOGIE1", "PHARMACO1",
      "COM-FR", "ANG-ACAD", "MATH-GEN", "METHOD-RECH"
    ];
  }
  if (norm.includes("ADMINISTRA") || norm.includes("COMPTABLE") || norm.includes("GESTION")) {
    return [
      "COMP-GEN", "MNG101", "MATH-FIN1", "COMP-INTER", "MICRO-ECO",
      "MACRO-ECO", "MNG-RH", "FIN-CORP", "MARKETING", "DROIT-AFFAIR",
      "STAT-APPL", "STRAT-ORG", "COM-FR", "ANG-ACAD", "MATH-GEN", "METHOD-RECH"
    ];
  }
  if (norm.includes("DROIT") || norm.includes("LAW")) {
    return [
      "INTRO-DROIT", "DROIT-CONST", "HIST-DROIT", "DROIT-PERS", "DROIT-OBLIG",
      "DROIT-CONST2", "DROIT-PENAL", "DROIT-ADMIN", "DROIT-TRAV", "DROIT-INT-PUB",
      "DROIT-REEL", "PROC-CIV", "PROC-PENAL", "COM-FR", "ANG-ACAD", "MATH-GEN", "METHOD-RECH"
    ];
  }
  if (norm.includes("DOUAN")) {
    return ["INTRO-ECO", "BURO-INF", "COMP-NIV1", "FISC-HT", "AUDIT-INTERN"];
  }
  if (norm.includes("TECHNOLOGIE MÉDICALE") || norm.includes("TECHNOLOGIE MEDICALE")) {
    return [
      "HEMATO1", "PARASITO", "MICROBIO1", "CHEM-CLIN1", "HEMATO2",
      "IMMUNO", "MICROBIO2", "LAB-BIOSEC", "SANG-TRANS", "CHEM-CLIN2",
      "LAB-QUALITY", "GENETIQUE", "LAB-STAGE", "LAB-MEMOIRE",
      "COM-FR", "ANG-ACAD", "MATH-GEN", "METHOD-RECH"
    ];
  }
  if (norm.includes("ÉLECTR") || norm.includes("ELECTR")) {
    return ["ELEC-BAT", "ELEC-IND", "COMP-SIMPL", "ENTREP-PRO"];
  }
  if (norm.includes("PLOMB")) {
    return ["PLOM101", "COMP-SIMPL", "ENTREP-PRO"];
  }
  if (norm.includes("CLIMAT") || norm.includes("FROID") || norm.includes("REFRI")) {
    return ["CLIM-REF", "COMP-SIMPL", "ENTREP-PRO"];
  }
  if (norm.includes("MÉCAN") || norm.includes("MECAN") || norm.includes("AUTO")) {
    return ["MEC101", "AUTO-DIAG", "AUTO-MECA", "COMP-SIMPL", "ENTREP-PRO"];
  }
  if (norm.includes("COUTUR") || norm.includes("SYLIS") || norm.includes("STYLIS") || norm.includes("MODEL")) {
    return ["COUT-101", "STYL-101", "COMP-SIMPL", "ENTREP-PRO"];
  }
  return ["COM-FR", "ANG-ACAD", "METHOD-RECH"];
};

export const getCollegeInnovationsDefaultCoefficient = (
  level: string,
  subjectCode: string
): number => {
  const code = (subjectCode || "").toUpperCase();
  const lvl = (level || "").toUpperCase();

  if (lvl === "MATERNELLE") return 1;

  if (code.includes("MATH")) return lvl === "SECONDAIRE" ? 5 : 4;
  if (code.includes("FRAN") || code.includes("FRA-") || code.includes("LITT")) return 4;
  if (code.includes("PHILO") || code.includes("PHI-")) return 4;
  if (code.includes("PHY") || code.includes("CHI")) return 4;
  if (code.includes("SVT") || code.includes("BIO")) return 3;
  if (code.includes("CREO") || code.includes("CRE-")) return 3;
  if (code.includes("SOC") || code.includes("HIST") || code.includes("GEO") || code.includes("ECO")) return 3;
  if (code.includes("ANGL") || code.includes("ANG-")) return 3;
  if (code.includes("ESPA") || code.includes("ESP-")) return 2;
  if (code.includes("INFO") || code.includes("INF-")) return 2;
  if (code.includes("EPS") || code.includes("SPORT")) return 1;

  if (lvl === "SECONDAIRE") return 4;
  if (lvl === "FONDAMENTALE") return 3;
  return 3;
};

const ClassManagement: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const { terminology, school, currentCampusId, campuses } = useSchool();
  const siegeCampus = campuses?.find(
    (c) =>
      c.name.toLowerCase().includes("siège") ||
      c.name.toLowerCase().includes("siege")
  );
  const siegeCampusId = siegeCampus ? siegeCampus.id : null;
  const isSiegeActive = !currentCampusId || currentCampusId === siegeCampusId;
  const [activeTab, setActiveTab] = useState<"classes" | "subjects" | "matrix" | "dashboard">(
    "classes",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [academicTab, setAcademicTab] = useState<string>("");
  const [cycleTab, setCycleTab] = useState<string>("Tous");

  useEffect(() => {
    if (!academicTab && school) {
      setAcademicTab(
        school.school_type === "UNIVERSITY"
          ? "Universitaire"
          : school.school_type === "PROFESSIONAL"
          ? "Professionnelle"
          : "Tous les cycles"
      );
    }
  }, [school, academicTab]);

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [siegeClasses, setSiegeClasses] = useState<SchoolClass[]>([]);
  const [importingDiscipline, setImportingDiscipline] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [associations, setAssociations] = useState<ClassSubject[]>([]);

  useEffect(() => {
    if (
      school?.school_type === "UNIVERSITY" &&
      !["Universitaire", "Professionnelle"].includes(academicTab)
    ) {
      setAcademicTab("Universitaire");
    } else if (
      school?.school_type === "PROFESSIONAL" &&
      academicTab !== "Professionnelle"
    ) {
      setAcademicTab("Professionnelle");
    } else if (
      school?.school_type === "CLASSIC" &&
      !["Tous les cycles", "Maternelle", "Fondamentale", "Secondaire"].includes(
        academicTab,
      )
    ) {
      setAcademicTab("Tous les cycles");
    }
  }, [school?.school_type, academicTab]);

  useEffect(() => {
    if (["Universitaire", "Professionnelle"].includes(academicTab)) {
      const grouped = getGroupedClasses(classes, academicTab);
      const keys = Object.keys(grouped || {});
      if (keys.length > 0) {
        if (cycleTab === "Tous" || !keys.includes(cycleTab)) {
          setCycleTab(keys[0]);
        }
      } else {
        setCycleTab("Tous");
      }
    } else {
      setCycleTab("Tous");
    }
  }, [academicTab, classes]);

  const hasProClasses = useMemo(() => {
    return classes.some(c => ["CERTIFICAT", "DIPLOME", "DIPLÔME"].includes(c.level?.toUpperCase() || ""));
  }, [classes]);

  const availableTabs = useMemo(() => {
    if (school?.school_type === "UNIVERSITY") {
      return ["Universitaire", "Professionnelle"];
    } else if (school?.school_type === "PROFESSIONAL") {
      return ["Professionnelle"];
    } else {
      const tabs = ["Tous les cycles", "Maternelle", "Fondamentale", "Secondaire"];
      if (hasProClasses) tabs.push("Professionnelle");
      return tabs;
    }
  }, [school?.school_type, hasProClasses]);

  const getDisciplineName = (className: string) => {
    let name = className.replace(
      /\s*(I|II|III|IV|V|VI|\d+|Année \d+|Niveau \d+|Niveau [IVX]+|\(L\d+\)|Licence \d+|Master \d+)\s*$/i,
      "",
    );
    name = name.replace(/^(licence|master|dipl[ôo]me|certificat)\s*(en|de)?\s*/i, "");
    return name.trim() || className;
  };

  const getClassSortValue = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes("PETITE")) return 10;
    if (n.includes("MOYENNE")) return 20;
    if (n.includes("GRANDE")) return 30;
    if (n.includes("PRESC")) return 5;

    // Fundamental
    const afMatch = n.match(/(\d+)/);
    if (n.includes("AF")) {
      if (afMatch) return 100 + parseInt(afMatch[1]);
      if (n.includes("ERE") || n.includes("ÈRE")) return 101;
    }

    // Secondary
    if (n.includes("NS")) {
      if (n.includes("IV") || n.includes("4")) return 204;
      if (n.includes("III") || n.includes("3")) return 203;
      if (n.includes("II") || n.includes("2")) return 202;
      if (n.includes("I") || n.includes("1")) return 201;
    }

    // University & Professional (Years I to VI)
    if (n.endsWith(" VI") || n.includes(" VI ")) return 306;
    if (n.endsWith(" V") || n.includes(" V ")) return 305;
    if (n.endsWith(" IV") || n.includes(" IV ")) return 304;
    if (n.endsWith(" III") || n.includes(" III ")) return 303;
    if (n.endsWith(" II") || n.includes(" II ")) return 302;
    if (n.endsWith(" I") || n.includes(" I ")) return 301;

    return 999;
  };

  const getGroupedClasses = useCallback((list: SchoolClass[], tab: string) => {
    // Sort the base list first before grouping to ensure consistent order within groups
    const sortedList = [...list].sort((a, b) => {
      const valA = getClassSortValue(a.name);
      const valB = getClassSortValue(b.name);
      if (valA !== valB) return valA - valB;
      return a.name.localeCompare(b.name);
    });

    if (tab === "Universitaire" || tab === "Professionnelle") {
      const filteredList = sortedList.filter((c) => {
        // Parse description if it's JSON to find if we've explicitly set division
        let division: string | undefined = undefined;
        if (c.description?.startsWith('{')) {
          try {
            const parsed = JSON.parse(c.description);
            division = parsed.division;
          } catch (e) {}
        }
        
        // If division is explicitly set, we respect it strictly!
        if (division) {
          return division === tab;
        }

        // Fallback for pre-existing classes where division was not specified
        const relevantLevels =
          tab === "Universitaire"
            ? ["DIPLOME", "DIPLÔME", "LICENCE", "MASTER"]
            : ["CERTIFICAT", "DIPLOME", "DIPLÔME"];
        return relevantLevels.includes(c.level?.toUpperCase());
      });

      const groups: Record<string, SchoolClass[]> = {};
      filteredList.forEach((c) => {
        const discipline = getDisciplineName(c.name);
        const groupKey = discipline;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(c);
      });

      return Object.keys(groups)
        .sort()
        .reduce(
          (acc, key) => {
            acc[key] = groups[key]; // Already sorted by sortedList
            return acc;
          },
          {} as Record<string, SchoolClass[]>,
        );
    } else if (tab === "Maternelle") {
      return {
        "Préscolaire (Maternelle)": sortedList.filter(
          (c) => c.level === "MATERNELLE",
        ),
      };
    } else if (tab === "Fondamentale") {
      return {
        Fondamentale: sortedList.filter((c) => c.level === "FONDAMENTALE"),
      };
    } else if (tab === "Secondaire") {
      return {
        Secondaire: sortedList.filter((c) => c.level === "SECONDAIRE"),
      };
    } else if (tab === "Tous les cycles") {
      return {
        Maternelle: sortedList.filter((c) => c.level === "MATERNELLE"),
        Fondamentale: sortedList.filter((c) => c.level === "FONDAMENTALE"),
        Secondaire: sortedList.filter((c) => c.level === "SECONDAIRE"),
        Autres: sortedList.filter(
          (c) =>
            ![
              "MATERNELLE",
              "FONDAMENTALE",
              "SECONDAIRE",
              "LICENCE",
              "MASTER",
              "CERTIFICAT",
              "DIPLOME",
              "DIPLÔME",
            ].includes(c.level),
        ),
      };
    } else {
      return {
        "Autres Niveaux / Cycles": sortedList.filter(
          (c) =>
            ![
              "MATERNELLE",
              "FONDAMENTALE",
              "SECONDAIRE",
              "LICENCE",
              "MASTER",
              "CERTIFICAT",
              "DIPLOME",
              "DIPLÔME",
            ].includes(c.level),
        ),
      };
    }
  }, []);

  // État pour la modale de confirmation personnalisée
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type:
      | "class"
      | "association"
      | "seed"
      | "migrate"
      | "subject"
      | "seed-university";
    id: string;
    title: string;
    message: string;
    name?: string;
    error?: string | null;
  }>({
    isOpen: false,
    type: "class",
    id: "",
    title: "",
    message: "",
    error: null,
  });

  const [customDisciplineModal, setCustomDisciplineModal] = useState<{
    isOpen: boolean;
    name: string;
    level: string;
    duration: number;
    division: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    name: "",
    level: "SECONDAIRE",
    duration: 1,
    division: "Secondaire",
    isSubmitting: false,
  });

  const [disciplineActionModal, setDisciplineActionModal] = useState<{
    isOpen: boolean;
    type: "rename" | "delete" | "move" | null;
    disciplineName: string;
    newName: string;
    targetDivision?: "Universitaire" | "Professionnelle";
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    type: null,
    disciplineName: "",
    newName: "",
    targetDivision: "Professionnelle",
    isSubmitting: false,
    error: null,
  });

  const [injectModal, setInjectModal] = useState<{
    isOpen: boolean;
    disciplineName: string;
    selectedCampusIds: string[];
    isSubmitting: boolean;
    success: string | null;
    error: string | null;
  }>({
    isOpen: false,
    disciplineName: "",
    selectedCampusIds: [],
    isSubmitting: false,
    success: null,
    error: null,
  });

  const [editCoefModal, setEditCoefModal] = useState<{
    isOpen: boolean;
    assocId: string;
    subjectName: string;
    className: string;
    coefficient: number;
    isSaving: boolean;
  }>({
    isOpen: false,
    assocId: "",
    subjectName: "",
    className: "",
    coefficient: 1,
    isSaving: false,
  });

  const handleSaveInlineCoef = async () => {
    if (!editCoefModal.assocId) return;
    setEditCoefModal((prev) => ({ ...prev, isSaving: true }));
    try {
      const { error } = await supabase
        .from("class_subjects")
        .update({ coefficient: editCoefModal.coefficient })
        .eq("id", editCoefModal.assocId)
        .eq("school_id", user.school_id);

      if (error) throw error;

      setAssociations((prev) =>
        prev.map((a) =>
          a.id === editCoefModal.assocId
            ? { ...a, coefficient: editCoefModal.coefficient }
            : a
        )
      );

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: "UPDATE",
        entity_type: "class_subject",
        entity_id: editCoefModal.assocId,
        details: { coefficient: editCoefModal.coefficient },
      });

      setNotification({
        type: "success",
        message: `Coefficient de "${editCoefModal.subjectName}" mis à jour (${editCoefModal.coefficient}).`,
      });
      setEditCoefModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      console.error("Error updating coefficient:", err);
      setNotification({
        type: "error",
        message: err.message || "Erreur lors de la mise à jour du coefficient.",
      });
    } finally {
      setEditCoefModal((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleExecuteInjection = async () => {
    const { disciplineName, selectedCampusIds } = injectModal;
    if (selectedCampusIds.length === 0) {
      setInjectModal(prev => ({ ...prev, error: "Veuillez sélectionner au moins une annexe." }));
      return;
    }

    setInjectModal(prev => ({ ...prev, isSubmitting: true, error: null, success: null }));

    try {
      const currentSchoolId = user.school_id;
      if (!currentSchoolId) {
        throw new Error("L'identifiant de l'établissement est introuvable.");
      }

      // Filter classes of this discipline
      const targetClasses = classes.filter(
        (c) => getDisciplineName(c.name) === disciplineName
      );

      if (targetClasses.length === 0) {
        throw new Error(`Aucun niveau trouvé pour la discipline "${disciplineName}".`);
      }

      let totalInsertedClasses = 0;
      let totalInsertedAssocs = 0;

      for (const targetCampusId of selectedCampusIds) {
        const targetClassNames = targetClasses.map(c => c.name);
        
        // 1. Check existing classes in the target branch
        const { data: existingLocal } = await supabase
          .from("classes")
          .select("name")
          .eq("school_id", currentSchoolId)
          .eq("campus_id", targetCampusId)
          .in("name", targetClassNames);

        const existingLocalNames = new Set(existingLocal?.map((c: any) => c.name) || []);
        
        // 2. Prepare classes that need to be inserted
        const toInsert = targetClasses
          .filter(c => !existingLocalNames.has(c.name))
          .map(c => ({
            school_id: currentSchoolId,
            campus_id: targetCampusId,
            name: c.name,
            level: c.level,
            description: c.description,
          }));

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from("classes")
            .insert(toInsert);

          if (insertErr) throw insertErr;
          totalInsertedClasses += toInsert.length;
        }

        // 2.5 ALONG WITH INJECTION, ALWAYS UPDATE already existing classes to mirror level and description from the Siège Social
        const existingToUpdate = targetClasses.filter(c => existingLocalNames.has(c.name));
        for (const refClass of existingToUpdate) {
          const { error: updateErr } = await supabase
            .from("classes")
            .update({
              level: refClass.level,
              description: refClass.description,
            })
            .eq("school_id", currentSchoolId)
            .eq("campus_id", targetCampusId)
            .eq("name", refClass.name);

          if (updateErr) {
            console.error(`Error updating level for existing class ${refClass.name} under campus ${targetCampusId}:`, updateErr);
          }
        }

        // 3. Reach for all classes in this branch (both newly inserted and pre-existing ones)
        const { data: allLocalClasses, error: fetchLocalErr } = await supabase
          .from("classes")
          .select("id, name, level")
          .eq("school_id", currentSchoolId)
          .eq("campus_id", targetCampusId)
          .in("name", targetClassNames);

        if (fetchLocalErr) throw fetchLocalErr;

        if (allLocalClasses && allLocalClasses.length > 0) {
          // 4. Fetch the original class_subjects associations from the Siège Social reference classes
          const originalClassIds = targetClasses.map(c => c.id);
          const { data: originalAssocs, error: assocErr } = await supabase
            .from("class_subjects")
            .select("*")
            .in("class_id", originalClassIds);

          let associationsToInsert: any[] = [];

          if (!assocErr && originalAssocs && originalAssocs.length > 0) {
            // 5. Map and insert associations
            associationsToInsert = originalAssocs.map(assoc => {
              const originalClass = targetClasses.find(c => c.id === assoc.class_id);
              const localClass = allLocalClasses.find((c: any) => c.name === originalClass?.name);
              if (localClass) {
                return {
                  class_id: localClass.id,
                  subject_id: assoc.subject_id,
                  coefficient: assoc.coefficient,
                  school_id: currentSchoolId,
                };
              }
              return null;
            }).filter(Boolean);
          }

          // FALLBACK FLOW: If originalAssocs is empty or we mapped nothing, we automatically link them of the system's seeded subjects!
          if (associationsToInsert.length === 0) {
            console.log("No associations found on Siège Social, running dynamic fallback matcher for branch...");
            const codes = getSubjectCodesForDiscipline(disciplineName);
            const { data: schoolSubs } = await supabase
              .from("subjects")
              .select("id, code")
              .eq("school_id", currentSchoolId)
              .in("code", codes);

            if (schoolSubs && schoolSubs.length > 0) {
              allLocalClasses.forEach((cls: any) => {
                schoolSubs.forEach((sub: any) => {
                  let coef = getCollegeInnovationsDefaultCoefficient(cls.level, sub.code);
                  associationsToInsert.push({
                    class_id: cls.id,
                    subject_id: sub.id,
                    coefficient: coef,
                    school_id: currentSchoolId,
                  });
                });
              });
            }
          }

          if (associationsToInsert.length > 0) {
            // Clean up old class-subject associations on the target branch first to prevent conflicts
            const localClassIds = allLocalClasses.map((c: any) => c.id);
            await supabase
              .from("class_subjects")
              .delete()
              .in("class_id", localClassIds)
              .eq("school_id", currentSchoolId);

            const { error: assocInsertErr } = await supabase
              .from("class_subjects")
              .insert(associationsToInsert);
            if (assocInsertErr) {
              console.error(`Error inserting class subjects/campus:`, assocInsertErr);
            } else {
              totalInsertedAssocs += associationsToInsert.length;
            }
          }
        }
      }

      AuditLogger.log({
        school_id: currentSchoolId,
        user_id: user.id,
        action: "CREATE",
        entity_type: "class",
        entity_id: "mass-inject-filiere",
        details: { discipline: disciplineName, campuses_count: selectedCampusIds.length, levels_inserted: totalInsertedClasses },
      });

      setInjectModal(prev => ({
        ...prev,
        isSubmitting: false,
        success: `La discipline "${disciplineName}" a été correctement injectée et synchronisée sur les annexes sélectionnées (${totalInsertedClasses} nouvelles promotions créées, et les matières d'enseignement ont été synchronisées pour l'ensemble des annexes).`,
      }));

      await fetchData();
    } catch (err: any) {
      console.error("Execute Injection Error:", err);
      setInjectModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.message || "Une erreur s'est produite lors de l'injection.",
      }));
    }
  };

  const handleAddCustomDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDisciplineModal.name.trim()) return;

    setCustomDisciplineModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const currentSchoolId = user.school_id;
      const RomanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII"];
      const classesToInsert: any[] = [];
      const baseName = customDisciplineModal.name.trim().toUpperCase();

      const years = Math.min(customDisciplineModal.duration, 7);

      for (let i = 0; i < years; i++) {
        const roman = RomanNumerals[i];
        const className = years > 1 ? `${baseName} ${roman}` : baseName;
        classesToInsert.push({
          school_id: currentSchoolId,
          campus_id: currentCampusId || null,
          name: className,
          level: customDisciplineModal.level,
          description: JSON.stringify({
            examsCount: 4,
            periodFormat: "SEMESTRE_INTRA",
            duration: `${years} ${["LICENCE", "MASTER", "DOCTORAT"].includes(customDisciplineModal.level) ? "ans" : "niveaux"}`,
            year: i + 1,
            division: customDisciplineModal.division,
          }),
        });
      }

      let existingQuery = supabase
        .from("classes")
        .select("name")
        .eq("school_id", currentSchoolId);

      if (currentCampusId && isValidUuid(currentCampusId)) {
        existingQuery = existingQuery.eq("campus_id", currentCampusId);
      }
      const { data: existing } = await existingQuery;
        
      const existingNames = new Set(existing?.map((c: any) => c.name) || []);
      const toInsert = classesToInsert.filter(c => !existingNames.has(c.name));

      if (toInsert.length > 0) {
        const chunkSize = 30;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const chunk = toInsert.slice(i, i + chunkSize);
          const { error } = await supabase.from("classes").insert(chunk);
          if (error) {
             if (error.message && error.message.includes('Failed to fetch')) {
               throw new Error("Erreur réseau: connexion interrompue ou délai dépassé. Veuillez réessayer.");
             }
             throw error;
          }
        }

        // Auto-bind subjects to newly created classes using Collège des Innovations standard default coefficients
        let newClassesQuery = supabase
          .from("classes")
          .select("id, name, level")
          .eq("school_id", currentSchoolId)
          .in("name", classesToInsert.map(c => c.name));

        if (currentCampusId && isValidUuid(currentCampusId)) {
          newClassesQuery = newClassesQuery.eq("campus_id", currentCampusId);
        }
        const { data: newClassesData } = await newClassesQuery;

        const { data: schoolSubjects } = await supabase
          .from("subjects")
          .select("id, code")
          .eq("school_id", currentSchoolId);

        if (newClassesData && newClassesData.length > 0 && schoolSubjects && schoolSubjects.length > 0) {
          const newAssocs: any[] = [];
          newClassesData.forEach((cls) => {
            schoolSubjects.forEach((sub) => {
              let coef = getCollegeInnovationsDefaultCoefficient(cls.level, sub.code);
              newAssocs.push({
                class_id: cls.id,
                subject_id: sub.id,
                coefficient: coef,
                school_id: currentSchoolId,
              });
            });
          });
          if (newAssocs.length > 0) {
            await supabase.from("class_subjects").upsert(newAssocs, { onConflict: "class_id,subject_id" });
          }
        }
      }

      AuditLogger.log({
        school_id: currentSchoolId,
        user_id: user.id,
        action: "CREATE",
        entity_type: "class",
        entity_id: "custom_discipline",
        details: { discipline: baseName, count: classesToInsert.length },
      });

      setNotification({
        type: "success",
        message: `Discipline ${baseName} ajoutée avec ${years} niveaux.`,
      });
      setCustomDisciplineModal((prev) => ({
        ...prev,
        isOpen: false,
        name: "",
        duration: 4,
        level: "LICENCE",
        division: "Universitaire",
      }));
      fetchData();
    } catch (err: any) {
      console.error(err);
      setNotification({
        type: "error",
        message: err.message || "Erreur lors de l'ajout de la discipline.",
      });
    } finally {
      setCustomDisciplineModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const renameDisciplineInClass = (className: string, oldDisc: string, newDisc: string) => {
    const escapedOld = oldDisc.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp("^" + escapedOld + "\\b", "i");
    if (regex.test(className)) {
      return className.replace(regex, newDisc);
    }
    if (className.toLowerCase().startsWith(oldDisc.toLowerCase())) {
      return newDisc + className.substring(oldDisc.length);
    }
    return className;
  };

  const handleExecuteDisciplineAction = async () => {
    const { type, disciplineName, newName } = disciplineActionModal;
    if (!type || !disciplineName) return;

    setDisciplineActionModal((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const targetClasses = classes.filter((c) => getDisciplineName(c.name) === disciplineName);
      const classIds = targetClasses.map((c) => c.id);

      if (type === "rename") {
        if (!newName.trim()) {
          throw new Error("Le nom de la discipline ne peut pas être vide.");
        }

        // Check if exists
        const existingDisciplines = Array.from(new Set(classes.map((c) => getDisciplineName(c.name))));
        const exists = existingDisciplines.some(
          (d) => d.toLowerCase() === newName.trim().toLowerCase() && d !== disciplineName
        );
        if (exists) {
          throw new Error("Une discipline avec ce nom existe déjà.");
        }

        // Rename classes sequentially in DB
        for (const c of targetClasses) {
          const updatedName = renameDisciplineInClass(c.name, disciplineName, newName.trim());
          const { error } = await supabase
            .from("classes")
            .update({ name: updatedName })
            .eq("id", c.id);
          if (error) throw error;
        }

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: "UPDATE",
          entity_type: "class",
          entity_id: "discipline-rename",
          details: { oldName: disciplineName, newName: newName.trim(), count: targetClasses.length },
        });

        setNotification({
          type: "success",
          message: `La discipline "${disciplineName}" a été renommée en "${newName.trim()}" (${targetClasses.length} niveaux mis à jour).`,
        });
      } else if (type === "delete") {
        if (classIds.length > 0) {
          // Programs cascade deletions in background to safely bypass foreign key constraints
          await supabase.from("class_subjects").delete().in("class_id", classIds).eq("school_id", user.school_id);
          await supabase.from("fee_plans").delete().in("class_id", classIds).eq("school_id", user.school_id);
          await supabase.from("enrollments").delete().in("class_id", classIds).eq("school_id", user.school_id);

          const { error } = await supabase
            .from("classes")
            .delete()
            .in("id", classIds)
            .eq("school_id", user.school_id);
          if (error) throw error;
        }

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: "DELETE",
          entity_type: "class",
          entity_id: "discipline-delete",
          details: { name: disciplineName, deletedCount: classIds.length },
        });

        setNotification({
          type: "success",
          message: `La discipline "${disciplineName}" et tous ses ${classIds.length} niveaux ont été supprimés avec succès.`,
        });

        if (cycleTab === disciplineName) {
          setCycleTab("Tous");
        }
      } else if (type === "move") {
        const { targetDivision } = disciplineActionModal;
        if (!targetDivision) {
          throw new Error("La division cible n'est pas spécifiée.");
        }

        // Move target classes division
        for (const c of targetClasses) {
          let descObj: any = {};
          if (c.description?.startsWith('{')) {
            try {
              descObj = JSON.parse(c.description);
            } catch (e) {}
          } else if (c.description) {
            descObj = { notes: c.description };
          }
          descObj.division = targetDivision;

          // Adjust level if incompatible
          let updatedLevel = c.level;
          if (targetDivision === "Professionnelle" && ["LICENCE", "MASTER"].includes(c.level?.toUpperCase())) {
            updatedLevel = "DIPLOME";
          } else if (targetDivision === "Universitaire" && c.level?.toUpperCase() === "CERTIFICAT") {
            updatedLevel = "DIPLOME";
          }

          const { error } = await supabase
            .from("classes")
            .update({
              description: JSON.stringify(descObj),
              level: updatedLevel,
            })
            .eq("id", c.id);
          if (error) throw error;
        }

        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: "UPDATE",
          entity_type: "class",
          entity_id: "discipline-move",
          details: { name: disciplineName, targetDivision, count: targetClasses.length },
        });

        setNotification({
          type: "success",
          message: `La discipline "${disciplineName}" a été déplacée avec succès vers la division ${targetDivision} (${targetClasses.length} niveaux mis à jour).`,
        });

        if (cycleTab === disciplineName) {
          setCycleTab("Tous");
        }
      }

      setDisciplineActionModal({
        isOpen: false,
        type: null,
        disciplineName: "",
        newName: "",
        targetDivision: "Professionnelle",
        isSubmitting: false,
        error: null,
      });
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setDisciplineActionModal((prev) => ({
        ...prev,
        error: err.message || "Une erreur est survenue lors de l'exécution de l'action.",
      }));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const mySchool = user.school_id;
      console.log("Fetching data for school_id:", mySchool);

      let classesQuery = supabase
        .from("classes")
        .select("*")
        .eq("school_id", mySchool);
        
      if (currentCampusId && isValidUuid(currentCampusId)) {
        classesQuery = classesQuery.eq("campus_id", currentCampusId);
      }
      
      const [classesRes, subjectsRes] = await Promise.all([
        classesQuery.order("name"),
        supabase
          .from("subjects")
          .select("*")
          .eq("school_id", mySchool)
          .order("name"),
      ]);

      if (classesRes.error) throw classesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;

      // Handle fetching Siège Social reference classes if on another campus
      let siegeClassesData: any[] = [];
      let targetSiegeId = null;
      try {
        const { data: cData } = await supabase
          .from("school_campuses")
          .select("id, name")
          .eq("school_id", mySchool);
        
        const foundSiege = cData?.find(
          (c: any) =>
            c.name.toLowerCase().includes("siège") ||
            c.name.toLowerCase().includes("siege")
        );
        targetSiegeId = foundSiege ? foundSiege.id : null;
      } catch (e) {
        console.error("Error finding siege campus in fetchData:", e);
      }

      const localIsSiegeActive = !currentCampusId || currentCampusId === targetSiegeId;
      if (!localIsSiegeActive && targetSiegeId) {
        const { data: siegeData, error: siegeErr } = await supabase
          .from("classes")
          .select("*")
          .eq("school_id", mySchool)
          .eq("campus_id", targetSiegeId);
        if (!siegeErr && siegeData) {
          siegeClassesData = siegeData;
        }
      }

      console.log(
        `Found ${classesRes.data?.length || 0} classes and ${subjectsRes.data?.length || 0} subjects.`,
      );

      const { data: assocData, error: assocError } = await supabase
        .from("class_subjects")
        .select(`
          id,
          class_id,
          subject_id,
          coefficient,
          subject:subjects(*)
        `)
        .eq("school_id", mySchool);

      if (assocError) throw assocError;

      const { data: studentsData } = await supabase
        .from("students")
        .select("id, class_id")
        .eq("school_id", mySchool);

      const resolvedAssoc = (assocData || []).map((a: any) => {
        const subj = Array.isArray(a.subject) ? a.subject[0] : a.subject;
        const fallbackSubj = subj || (subjectsRes.data || []).find((s: any) => s.id === a.subject_id);
        const coef = Number(a.coefficient) || Number(fallbackSubj?.coefficient) || 1;
        return {
          ...a,
          coefficient: coef,
          subject: fallbackSubj
        };
      });

      const enrichedClasses = (classesRes.data || []).map((cls) => ({
        ...cls,
        subjects_count:
          resolvedAssoc.filter((a: any) => a.class_id === cls.id).length || 0,
        students_count:
          studentsData?.filter((s: any) => s.class_id === cls.id).length || 0,
      }));

      setClasses(enrichedClasses);
      setSiegeClasses(siegeClassesData);
      setSubjects(subjectsRes.data || []);
      setAssociations(resolvedAssoc);
    } catch (err) {
      console.error("Erreur de chargement académique:", err);
    } finally {
      setLoading(false);
    }
  }, [user.school_id, currentCampusId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fonction déclenchée au clic sur le bouton de suppression (Classe)
  const triggerDeleteClass = (classId: string, className: string) => {
    setConfirmModal({
      isOpen: true,
      type: "class",
      id: classId,
      name: className,
      title: "Suppression définitive",
      message: `Voulez-vous vraiment supprimer cet(te) ${terminology.class.toLowerCase()} ? Cette action supprimera également les tarifs et les attributions liés.`,
      error: null,
    });
  };

  // Fonction déclenchée au clic sur le bouton de suppression (Matière/Classe)
  const triggerDeleteAssociation = (
    assocId: string,
    subjectName: string,
    className: string,
  ) => {
    setConfirmModal({
      isOpen: true,
      type: "association",
      id: assocId,
      name: `${subjectName} (${className})`,
      title: `Retirer ${terminology.subject.toLowerCase()}`,
      message: `Voulez-vous retirer ce(tte) ${terminology.subject.toLowerCase()} de la sélection ?`,
      error: null,
    });
  };

  // Fonction déclenchée au clic sur le bouton de suppression (Matière Globale)
  const triggerDeleteSubject = (subjectId: string, subjectName: string) => {
    setConfirmModal({
      isOpen: true,
      type: "subject",
      id: subjectId,
      name: subjectName,
      title: "Suppression Catalogue",
      message: `Voulez-vous supprimer ce(tte) ${terminology.subject.toLowerCase()} du catalogue global ? Il(Elle) ne sera plus disponible pour de nouvelles assignations.`,
      error: null,
    });
  };

  // Exécution réelle de la suppression ou action massive
  const handlePerformDelete = async () => {
    const { id, type } = confirmModal;

    if (type === "seed" || type === "migrate") {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      await executeSeed();
      return;
    }

    if (type === "seed-university") {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      await executeSpecialSeed();
      return;
    }

    setIsDeleting(id);
    setConfirmModal((prev) => ({ ...prev, error: null }));

    try {
      if (type === "class") {
        // Enforce safe deletion cascade programmatically to avoid DB constraint failures
        await supabase.from("class_subjects").delete().eq("class_id", id).eq("school_id", user.school_id);
        await supabase.from("fee_plans").delete().eq("class_id", id).eq("school_id", user.school_id);
        await supabase.from("enrollments").delete().eq("class_id", id).eq("school_id", user.school_id);

        const { error, status } = await supabase
          .from("classes")
          .delete({ count: "exact" })
          .eq("id", id)
          .eq("school_id", user.school_id);

        if (error) throw error;

        if (status === 204 || status === 200) {
          AuditLogger.log({
            school_id: user.school_id,
            user_id: user.id,
            action: "DELETE",
            entity_type: "class",
            entity_id: id,
            details: { name: confirmModal.name },
          });
          setClasses((prev) => prev.filter((c) => c.id !== id));
          setAssociations((prev) => prev.filter((a) => a.class_id !== id));
        }
      } else if (type === "subject") {
        const { error } = await supabase.from("subjects").delete().eq("id", id).eq("school_id", user.school_id);
        if (error) throw error;
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: "DELETE",
          entity_type: "subject",
          entity_id: id,
          details: { name: confirmModal.name },
        });
        setSubjects((prev) => prev.filter((s) => s.id !== id));
      } else {
        const { error } = await supabase
          .from("class_subjects")
          .delete()
          .eq("id", id)
          .eq("school_id", user.school_id);
        if (error) throw error;
        AuditLogger.log({
          school_id: user.school_id,
          user_id: user.id,
          action: "DELETE",
          entity_type: "class_subject",
          entity_id: id,
          details: { name: confirmModal.name },
        });
        setAssociations((prev) => prev.filter((a) => a.id !== id));
      }

      // Fermer la modale en cas de succès
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      setConfirmModal((prev) => ({
        ...prev,
        error:
          err.code === "23503"
            ? "Impossible : Des étudiants sont encore inscrits dans cette classe."
            : err.message,
      }));
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDisciplineName = useCallback(
    (name: string) => {
      if (school?.school_type !== "UNIVERSITY" && school?.school_type !== "PROFESSIONAL") return name;
      return getDisciplineName(name);
    },
    [school?.school_type],
  );

  const getRomanSuffix = useCallback(
    (name: string) => {
      const match = name.match(/\s+(I|II|III|IV|V|VI|VII|\d+)$/i);
      if (match) return match[1].toUpperCase();
      
      const specialMatch = name.match(/\s+(Année\s+\d+|Niveau\s+\d+|Niveau\s+[IVX]+|\(L\d+\)|Licence\s+\d+|Master\s+\d+)\s*$/i);
      if (specialMatch) return specialMatch[1];
      
      return "";
    },
    []
  );

  const validClasses = useMemo(() => {
    if (!school) return classes;
    const type = school.school_type;

    const classicLevels = ["MATERNELLE", "FONDAMENTALE", "SECONDAIRE"];
    const uniLevels = ["LICENCE", "MASTER", "DIPLOME", "DIPLÔME"];
    const proLevels = ["CERTIFICAT", "DIPLOME", "DIPLÔME"];

    const allStandardLevels = [...classicLevels, ...uniLevels, ...proLevels];

    return classes.filter((c) => {
      const level = c.level?.toUpperCase() || "";
      if (!allStandardLevels.includes(level)) return true;
      if (type === "UNIVERSITY") return [...uniLevels, ...proLevels].includes(level);
      if (type === "PROFESSIONAL") return proLevels.includes(level);
      if (hasProClasses && proLevels.includes(level)) return true;
      return classicLevels.includes(level);
    });
  }, [classes, school, hasProClasses]);

  const filteredClasses = useMemo(() => {
    return validClasses.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.level.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [validClasses, searchTerm]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [subjects, searchTerm]);

  const handleSeedSpecialDisciplines = () => {
    setConfirmModal({
      isOpen: true,
      type: "seed-university",
      id: "seed-univ-action",
      title: "Ajout des disciplines",
      message: `Voulez-vous ajouter des disciplines standards pour votre établissement ?`,
      error: null,
    });
  };

  const executeSpecialSeed = async () => {
    setIsSeeding(true);
    setNotification(null);
    try {
      const currentSchoolId = user.school_id;
      
      const universityDisciplines = [
        { name: "Sciences Informatiques", level: "LICENCE", duration: 4 },
        { name: "Génie Software / Génie Logiciel", level: "LICENCE", duration: 4 },
        { name: "Réseaux & Télécommunications", level: "LICENCE", duration: 4 },
        { name: "Intelligence Artificielle & Data", level: "LICENCE", duration: 4 },
        { name: "Cybersécurité & Cloud Computing", level: "LICENCE", duration: 4 },
        { name: "Sciences Administratives", level: "LICENCE", duration: 4 },
        { name: "Sciences Comptables & Audit", level: "LICENCE", duration: 4 },
        { name: "Gestion des Ressources Humaines", level: "LICENCE", duration: 4 },
        { name: "Marketing & Management Digital", level: "LICENCE", duration: 4 },
        { name: "Sciences Économiques & Finance", level: "LICENCE", duration: 4 },
        { name: "Droit & Sciences Juridiques", level: "LICENCE", duration: 4 },
        { name: "Relations Internationales", level: "LICENCE", duration: 4 },
        { name: "Sciences Infirmières", level: "LICENCE", duration: 4 },
        { name: "Médecine Générale", level: "LICENCE", duration: 6 },
        { name: "Médecine Dentaire", level: "LICENCE", duration: 5 },
        { name: "Pharmacologie & Toxicologie", level: "LICENCE", duration: 4 },
        { name: "Technologie Médicale & Laboratoire", level: "LICENCE", duration: 4 },
        { name: "Sciences de la Nutrition", level: "LICENCE", duration: 4 },
        { name: "Science de l'Éducation", level: "LICENCE", duration: 4 },
        { name: "Génie Civil & Infrastructures", level: "LICENCE", duration: 5 },
        { name: "Génie Électromécanique", level: "LICENCE", duration: 5 },
        { name: "Communication Sociale & Journalisme", level: "LICENCE", duration: 4 },
        { name: "Psychologie Clinique & Sociale", level: "LICENCE", duration: 4 },
      ];

      const professionalDisciplines = [
        { name: "Comptabilité Informatisée & Fiscalité", level: "DIPLOME", duration: 2 },
        { name: "Technique Douanière & Transit", level: "DIPLOME", duration: 2 },
        { name: "Secrétariat Médical & Gestion", level: "DIPLOME", duration: 2 },
        { name: "Marketing & Vente Professionnelle", level: "DIPLOME", duration: 2 },
        { name: "Informatique de Bureau & Administration", level: "CERTIFICAT", duration: 1 },
        { name: "Assistance Administrative & Bilingue", level: "CERTIFICAT", duration: 1 },
        { name: "Maintenance Informatique & Réseaux", level: "DIPLOME", duration: 2 },
        { name: "Graphisme & Design Multimédia", level: "CERTIFICAT", duration: 1 },
        { name: "Développement Web & Applications", level: "DIPLOME", duration: 2 },
        { name: "Électricité du Bâtiment & Solaire", level: "CERTIFICAT", duration: 1 },
        { name: "Plomberie & Sanitaire Moderne", level: "CERTIFICAT", duration: 1 },
        { name: "Climatisation, Froid & Réfrigération", level: "DIPLOME", duration: 2 },
        { name: "Mécanique Automobile & Diagnostic", level: "DIPLOME", duration: 2 },
        { name: "Soudure & Fabrication Industrielle", level: "CERTIFICAT", duration: 1 },
        { name: "Cuisine, Restauration & Traiteur", level: "DIPLOME", duration: 2 },
        { name: "Pâtisserie & Boulangerie Artisanale", level: "CERTIFICAT", duration: 1 },
        { name: "Gestion Hôtelière & Touristique", level: "DIPLOME", duration: 2 },
        { name: "Couture, Stylisme & Modélisme", level: "DIPLOME", duration: 2 },
        { name: "Esthétique, Cosmétique & Maquillage", level: "CERTIFICAT", duration: 1 },
        { name: "Coiffure Professionnelle & Visagisme", level: "CERTIFICAT", duration: 1 },
        { name: "Secourisme, Hygiène & Soins d'Urgence", level: "CERTIFICAT", duration: 1 },
      ];

      const baseDisciplines = school?.school_type === "UNIVERSITY" 
        ? [...universityDisciplines, ...professionalDisciplines] 
        : professionalDisciplines;

      const RomanNumerals = ["I", "II", "III", "IV", "V", "VI"];
      const classesToInsert: any[] = [];

      baseDisciplines.forEach((base) => {
        for (let i = 0; i < base.duration; i++) {
          const roman = RomanNumerals[i];
          const className = `${base.name} ${roman}`;
          classesToInsert.push({
            school_id: currentSchoolId,
            campus_id: currentCampusId || null,
            name: className,
            level: base.level,
            description: JSON.stringify({
              examsCount: 4,
              periodFormat: "SEMESTRE_INTRA",
              duration: `${base.duration} ans`,
              year: i + 1,
            }),
          });
        }
      });

      let existingQuery = supabase
        .from("classes")
        .select("name")
        .eq("school_id", currentSchoolId);

      if (currentCampusId && isValidUuid(currentCampusId)) {
        existingQuery = existingQuery.eq("campus_id", currentCampusId);
      }
      const { data: existing } = await existingQuery;
        
      const existingNames = new Set(existing?.map((c: any) => c.name) || []);
      const toInsert = classesToInsert.filter(c => !existingNames.has(c.name));

      if (toInsert.length > 0) {
        const chunkSize = 30;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const chunk = toInsert.slice(i, i + chunkSize);
          const { error } = await supabase.from("classes").insert(chunk);
          if (error) {
             if (error.message && error.message.includes('Failed to fetch')) {
               throw new Error("Erreur réseau: connexion interrompue ou délai dépassé. Veuillez réessayer.");
             }
             throw error;
          }
        }
      }

      AuditLogger.log({
        school_id: user.school_id,
        user_id: user.id,
        action: "CREATE",
        entity_type: "class",
        entity_id: "mass-seed-univ",
        details: { count: classesToInsert.length },
      });

      setNotification({
        type: "success",
        message: `${classesToInsert.length} cursus / disciplines par promotions ajoutés avec succès. Liaison automatique avec les matières en cours...`,
      });

      // Auto-call executeSeed to bind subjects immediately
      await executeSeed();

      fetchData(); // Reload classes
    } catch (err: any) {
      console.error("Special Seed Error:", err);
      setNotification({
        type: "error",
        message: err.message || `Erreur lors de l'ajout des ${terminology.options.toLowerCase()}.`,
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleImportDiscipline = async (disciplineName: string) => {
    setImportingDiscipline(disciplineName);
    setNotification(null);
    try {
      const currentSchoolId = user.school_id;
      if (!currentSchoolId || !currentCampusId) {
        throw new Error("Impossible d'identifier l'établissement ou l'annexe courante.");
      }

      // Fetch Siège Social campus id freshly to resolve target siege id correctly
      const { data: campusesData, error: campusesErr } = await supabase
        .from("school_campuses")
        .select("id, name")
        .eq("school_id", currentSchoolId);

      if (campusesErr) throw campusesErr;

      const foundSiege = campusesData?.find(
        (c: any) =>
          c.name.toLowerCase().includes("siège") ||
          c.name.toLowerCase().includes("siege")
      );
      const targetSiegeId = foundSiege ? foundSiege.id : null;

      if (!targetSiegeId) {
        throw new Error("L'identifiant du Siège Social de référence est introuvable.");
      }

      // Freshly fetch reference classes of this discipline from the Siège Social
      const { data: siegeClassesFresh, error: siegeClassesFreshErr } = await supabase
        .from("classes")
        .select("*")
        .eq("school_id", currentSchoolId)
        .eq("campus_id", targetSiegeId);

      if (siegeClassesFreshErr) throw siegeClassesFreshErr;

      // Filter classes of this discipline in the fresh Siège Social state
      const targetClasses = (siegeClassesFresh || []).filter(
        (c) => getDisciplineName(c.name) === disciplineName
      );

      if (targetClasses.length === 0) {
        throw new Error("Aucun niveau trouvé pour cette discipline au Siège Social.");
      }

      // Check if any of these levels already exist in our current annex
      const targetClassNames = targetClasses.map(c => c.name);
      const { data: existingLocal } = await supabase
        .from("classes")
        .select("name")
        .eq("school_id", currentSchoolId)
        .eq("campus_id", currentCampusId)
        .in("name", targetClassNames);

      const existingLocalNames = new Set(existingLocal?.map((c: any) => c.name) || []);
      const toInsert = targetClasses
        .filter(c => !existingLocalNames.has(c.name))
        .map(c => ({
          school_id: currentSchoolId,
          campus_id: currentCampusId,
          name: c.name,
          level: c.level,
          description: c.description,
        }));

      // 1. Insert any missing classes
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from("classes")
          .insert(toInsert);

        if (insertErr) throw insertErr;
      }

      // 1.5 ALWAYS UPDATE existing classes to make sure we reflect "notre dernière modification de Niveau et description/division"
      const existingToUpdate = targetClasses.filter(c => existingLocalNames.has(c.name));
      for (const refClass of existingToUpdate) {
        const { error: updateErr } = await supabase
          .from("classes")
          .update({
            level: refClass.level,
            description: refClass.description,
          })
          .eq("school_id", currentSchoolId)
          .eq("campus_id", currentCampusId)
          .eq("name", refClass.name);

        if (updateErr) {
          console.error(`Error syncing level and description for class ${refClass.name}:`, updateErr);
        }
      }

      // 2. Fetch all local classes of this discipline (both newly inserted and pre-existing)
      const { data: allLocalClasses, error: fetchLocalErr } = await supabase
        .from("classes")
        .select("id, name, level")
        .eq("school_id", currentSchoolId)
        .eq("campus_id", currentCampusId)
        .in("name", targetClassNames);

      if (fetchLocalErr) throw fetchLocalErr;

      let importedAssocsCount = 0;
      if (allLocalClasses && allLocalClasses.length > 0) {
        // 3. Fetch original associations for those classes from the Siège Social reference classes
        const originalClassIds = targetClasses.map(c => c.id);
        const { data: originalAssocs, error: assocErr } = await supabase
          .from("class_subjects")
          .select("*")
          .in("class_id", originalClassIds);

        let associationsToInsert: any[] = [];

        if (!assocErr && originalAssocs && originalAssocs.length > 0) {
          // 4. Map targetClasses from siege to local classes based on name
          associationsToInsert = originalAssocs.map(assoc => {
            const originalClass = targetClasses.find(c => c.id === assoc.class_id);
            const localClass = allLocalClasses.find((c: any) => c.name === originalClass?.name);
            if (localClass) {
              return {
                class_id: localClass.id,
                subject_id: assoc.subject_id,
                coefficient: assoc.coefficient,
                school_id: currentSchoolId,
              };
            }
            return null;
          }).filter(Boolean);
        }

        // FALLBACK FLOW: If originalAssocs is empty or we mapped nothing, we automatically link them of the system's seeded subjects!
        if (associationsToInsert.length === 0) {
          console.log("No associations found on Siège Social, running dynamic fallback matcher...");
          const codes = getSubjectCodesForDiscipline(disciplineName);
          const { data: schoolSubs } = await supabase
            .from("subjects")
            .select("id, code")
            .eq("school_id", currentSchoolId)
            .in("code", codes);

          if (schoolSubs && schoolSubs.length > 0) {
            allLocalClasses.forEach((cls: any) => {
              schoolSubs.forEach((sub: any) => {
                let coef = getCollegeInnovationsDefaultCoefficient(cls.level, sub.code);
                associationsToInsert.push({
                  class_id: cls.id,
                  subject_id: sub.id,
                  coefficient: coef,
                  school_id: currentSchoolId,
                });
              });
            });
          }
        }

        if (associationsToInsert.length > 0) {
          // Clean up old class-subject associations on the current local campus to prevent conflicts
          const localClassIds = allLocalClasses.map((c: any) => c.id);
          await supabase
            .from("class_subjects")
            .delete()
            .in("class_id", localClassIds);

          const { error: assocInsertErr } = await supabase
            .from("class_subjects")
            .insert(associationsToInsert);

          if (assocInsertErr) {
            console.error("Erreur liaison matières importées:", assocInsertErr);
          } else {
            importedAssocsCount = associationsToInsert.length;
          }
        }
      }

      AuditLogger.log({
        school_id: currentSchoolId,
        user_id: user.id,
        action: "CREATE",
        entity_type: "class",
        entity_id: "import-siege-discipline",
        details: { discipline: disciplineName, levels: targetClasses.length, campus_id: currentCampusId },
      });

      setNotification({
        type: "success",
        message: `La discipline "${disciplineName}" (${allLocalClasses?.length || 0} niveaux) a été importée et synchronisée avec succès pour votre annexe (${importedAssocsCount} matières liées) !`,
      });

      // Reload classes
      await fetchData();
    } catch (err: any) {
      console.error("Import Siege Discipline Error:", err);
      setNotification({
        type: "error",
        message: err.message || "Erreur lors de l'importation de la discipline depuis le Siège Social.",
      });
    } finally {
      setImportingDiscipline(null);
    }
  };

  const handleSeedSubjects = () => {
    setConfirmModal({
      isOpen: true,
      type: "seed",
      id: "seed-action",
      title: "Injection Catalogue",
      message: `Voulez-vous injecter le catalogue de ${terminology.subjects.toLowerCase()} standards ? Cela ajoutera les éléments manquants et les liera à vos ${terminology.classes.toLowerCase()}.`,
      error: null,
    });
  };

  const executeSeed = async () => {
    setIsSeeding(true);
    setNotification(null);
    try {
      const currentSchoolId = user.school_id;

      if (!currentSchoolId) throw new Error("Impossible de vérifier votre profil.");

      console.log("Starting robust seed for school_id:", currentSchoolId);

      // Fetch school type
      const { data: schoolData } = await supabase
        .from("schools")
        .select("school_type")
        .eq("id", currentSchoolId)
        .single();
      const currentSchoolType = schoolData?.school_type || "CLASSIC";

      // CLEANUP PHASE: Remove classic subjects if we are a University/Professional, to fix any previous incorrect seeds.
      if (
        currentSchoolType === "UNIVERSITY" ||
        currentSchoolType === "PROFESSIONAL"
      ) {
        const classicCodes = [
          "MATH-FOND",
          "FRAN-FOND",
          "CREO-FOND",
          "SCI-EXP",
          "SCI-SOC",
          "ANGL-GEN",
          "INFO-TECH",
          "EPS-SPORT",
          "PHY-CHI-NS",
          "SVT-NS",
          "PHILO",
          "ECONO",
          "LITT-UNIV",
          "INIT-MATH",
          "LANG-COMM",
          "PSYCHOMOT",
          "ARTS-DESS",
          "EVEIL-SCI",
          "ESPA-GEN",
          "FRA-STD",
          "CRE-STD",
          "MAT-STD",
          "ANG-STD",
          "ESP-STD",
          "PHY-STD",
          "CHI-STD",
          "SVT-STD",
          "PHI-STD",
          "ECO-STD",
          "INF-STD",
          "EPS-STD",
        ];
        await supabase
          .from("subjects")
          .delete()
          .eq("school_id", currentSchoolId)
          .in("code", classicCodes);
      }

      // 2. Injection via RPC
      const { error: rpcError } = await supabase.rpc("seed_subjects_pro", {
        target_school_id: currentSchoolId,
      });

      // 3. Vérification de présence (on attend un peu pour laisser Supabase indexer si besoin)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data: existingSubs, error: fetchError } = await supabase
        .from("subjects")
        .select("id, code")
        .eq("school_id", currentSchoolId);

      if (fetchError) {
        if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
          throw new Error("Erreur réseau: Impossible de récupérer les données des matières. Veuillez vérifier votre connexion.");
        }
        throw fetchError;
      }

      // 4. Si toujours rien, tentative d'injection directe (Fallback)
      if (!existingSubs || existingSubs.length === 0) {
        console.warn(
          "RPC didn't produce visible subjects, trying direct upsert...",
        );
        let standardSubjects: any[] = [];

        if (currentSchoolType === "UNIVERSITY") {
          standardSubjects = [
            // Common Uni
            {
              school_id: currentSchoolId,
              name: "Communication Française",
              code: "COM-FR",
              description: "Université - Tronc Commun",
            },
            {
              school_id: currentSchoolId,
              name: "Anglais Académique",
              code: "ANG-ACAD",
              description: "Université - Tronc Commun",
            },
            {
              school_id: currentSchoolId,
              name: "Mathématiques Générales",
              code: "MATH-GEN",
              description: "Université - Mathématiques",
            },
            {
              school_id: currentSchoolId,
              name: "Méthodologie de Recherche",
              code: "METHOD-RECH",
              description: "Université - Tronc Commun",
            },
            {
              school_id: currentSchoolId,
              name: "Introduction à l'Économie",
              code: "INTRO-ECO",
              description: "Université - Tronc Commun",
            },
            {
              school_id: currentSchoolId,
              name: "Sociologie d'Haïti",
              code: "SOCIO-HT",
              description: "Université - Tronc Commun",
            },
            // Informatique
            {
              school_id: currentSchoolId,
              name: "Algorithmique et Programmation",
              code: "ALGO101",
              description: "Sciences Informatiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Mathématiques Discrètes",
              code: "MATH-DISC",
              description: "Sciences Informatiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Architecture des Ordinateurs",
              code: "ARCHI-ORD",
              description: "Sciences Informatiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Introduction aux Technologies de l'Info",
              code: "INTRO-INFO",
              description: "Sciences Informatiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Programmation Orientée Objet",
              code: "PROG-OOP",
              description: "Sciences Informatiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Bases de Données",
              code: "DBD201",
              description: "Sciences Informatiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Réseaux Informatiques I",
              code: "RESEAUX1",
              description: "Sciences Informatiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Structures de Données",
              code: "STRUC-DAT",
              description: "Sciences Informatiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Développement Web Full-Stack",
              code: "PROG-WEB",
              description: "Sciences Informatiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Ingénierie Logicielle",
              code: "ING-LOG",
              description: "Sciences Informatiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Sécurité Informatique",
              code: "SEC-INF",
              description: "Sciences Informatiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Systèmes d'Exploitation",
              code: "SYS-EXPLOIT",
              description: "Sciences Informatiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Introduction à l'IA",
              code: "IA-INTRO",
              description: "Sciences Informatiques - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Architecture Cloud",
              code: "CLOUD-ARCH",
              description: "Sciences Informatiques - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Projet de Fin d'Études (Informatique)",
              code: "PROJ-GRAD-INF",
              description: "Sciences Informatiques - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Entrepreneuriat Numérique",
              code: "ENTREP-NUM",
              description: "Sciences Informatiques - L4",
            },
            // Administratives
            {
              school_id: currentSchoolId,
              name: "Comptabilité Générale I",
              code: "COMP-GEN",
              description: "Sciences Administratives - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Principes de Management",
              code: "MNG101",
              description: "Sciences Administratives - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Mathématiques Financières I",
              code: "MATH-FIN1",
              description: "Sciences Administratives - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Comptabilité Intermédiaire",
              code: "COMP-INTER",
              description: "Sciences Administratives - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Microéconomie",
              code: "MICRO-ECO",
              description: "Sciences Administratives - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Macroéconomie",
              code: "MACRO-ECO",
              description: "Sciences Administratives - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Gestion des Ressources Humaines",
              code: "MNG-RH",
              description: "Sciences Administratives - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Finance d'Entreprise",
              code: "FIN-CORP",
              description: "Sciences Administratives - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Principes de Marketing",
              code: "MARKETING",
              description: "Sciences Administratives - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Droit des Affaires",
              code: "DROIT-AFFAIR",
              description: "Sciences Administratives - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Statistiques Appliquées",
              code: "STAT-APPL",
              description: "Sciences Administratives - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Stratégie des Organisations",
              code: "STRAT-ORG",
              description: "Sciences Administratives - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Comptabilité Publique",
              code: "COMP-PUBLIC",
              description: "Sciences Administratives - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Commerce International",
              code: "COMM-INTERN",
              description: "Sciences Administratives - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Projet de Fin d'Études (Administration)",
              code: "PROJ-GRAD-ADM",
              description: "Sciences Administratives - L4",
            },
            // Juridiques
            {
              school_id: currentSchoolId,
              name: "Introduction au Droit",
              code: "INTRO-DROIT",
              description: "Sciences Juridiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Droit Constitutionnel I",
              code: "DROIT-CONST",
              description: "Sciences Juridiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Histoire du Droit",
              code: "HIST-DROIT",
              description: "Sciences Juridiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Droit des Personnes",
              code: "DROIT-PERS",
              description: "Sciences Juridiques - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Droit des Obligations",
              code: "DROIT-OBLIG",
              description: "Sciences Juridiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Droit Constitutionnel II",
              code: "DROIT-CONST2",
              description: "Sciences Juridiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Droit Pénal Général",
              code: "DROIT-PENAL",
              description: "Sciences Juridiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Droit Administratif I",
              code: "DROIT-ADMIN",
              description: "Sciences Juridiques - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Droit du Travail",
              code: "DROIT-TRAV",
              description: "Sciences Juridiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Droit International Public",
              code: "DROIT-INT-PUB",
              description: "Sciences Juridiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Droit Réel (Régime Foncier)",
              code: "DROIT-REEL",
              description: "Sciences Juridiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Procédure Civile Générale",
              code: "PROC-CIV",
              description: "Sciences Juridiques - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Droit International Privé",
              code: "DROIT-INT-PRIV",
              description: "Sciences Juridiques - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Procédure Pénale",
              code: "PROC-PENAL",
              description: "Sciences Juridiques - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Mémoire Juridique",
              code: "MEMOIRE-JUR",
              description: "Sciences Juridiques - L4",
            },
            // Infirmieres
            {
              school_id: currentSchoolId,
              name: "Anatomie et Physiologie I",
              code: "ANATOMIE1",
              description: "Sciences Infirmières - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Anatomie et Physiologie II",
              code: "ANATOMIE2",
              description: "Sciences Infirmières - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Nutrition et Diététique",
              code: "NUTRITION",
              description: "Sciences Infirmières - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Fondements des Soins Infirmiers",
              code: "SOINS-FOND",
              description: "Sciences Infirmières - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Microbiologie et Parasitologie",
              code: "MICRO-PARASIT",
              description: "Sciences Infirmières - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Pathologie Médicale I",
              code: "PATHOLOGIE1",
              description: "Sciences Infirmières - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Soins Infirmiers à l'Adulte",
              code: "SOINS-ADULTE",
              description: "Sciences Infirmières - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacologie Clinique",
              code: "PHARMACO1",
              description: "Sciences Infirmières - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Soins Infirmiers en Pédiatrie",
              code: "SOINS-PEDIAT",
              description: "Sciences Infirmières - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Soins Maternels et Obstétriques",
              code: "SOINS-MATERN",
              description: "Sciences Infirmières - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Éthique et Déontologie",
              code: "ETHIQUE-DEONT",
              description: "Sciences Infirmières - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Santé Communautaire",
              code: "SANTE-COMM",
              description: "Sciences Infirmières - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Soins de Santé Mentale",
              code: "SOINS-PSYCH",
              description: "Sciences Infirmières - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Gestion des Services de Soins",
              code: "GEST-SOINS",
              description: "Sciences Infirmières - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Méthodologie de Recherche (Soins)",
              code: "RECH-INF",
              description: "Sciences Infirmières - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Stage d'Intégration Professionnelle",
              code: "STAGE-INTEG",
              description: "Sciences Infirmières - L4",
            },
            // Genie Civil
            {
              school_id: currentSchoolId,
              name: "Physique Mécanique",
              code: "PHY-MECAN",
              description: "Génie Civil - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Dessin Industriel et DAO",
              code: "DESSIN-INDA",
              description: "Génie Civil - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Chimie de l'Ingénieur",
              code: "CHIMIE-GEN",
              description: "Génie Civil - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Analyse Mathématique II",
              code: "CALCULU2",
              description: "Génie Civil - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Mécanique Rationnelle / Statique",
              code: "STATIQUE",
              description: "Génie Civil - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Algèbre Linéaire",
              code: "ALGEBRE-LIN",
              description: "Génie Civil - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Topographie Générale",
              code: "TOPOGRAPH",
              description: "Génie Civil - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Résistance des Matériaux I",
              code: "RDM1",
              description: "Génie Civil - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Hydraulique Générale",
              code: "HYDRAU1",
              description: "Génie Civil - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Géotechnique",
              code: "GEOTECH1",
              description: "Génie Civil - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Matériaux de Construction",
              code: "MATER-CONSTR",
              description: "Génie Civil - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Béton Armé I",
              code: "BETON-ARME1",
              description: "Génie Civil - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Charpentes Métalliques",
              code: "CHARP-MET",
              description: "Génie Civil - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Dynamique des Structures",
              code: "DYN-STRUCT",
              description: "Génie Civil - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Gestion de Chantiers",
              code: "GEST-CHANT",
              description: "Génie Civil - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Béton Armé II",
              code: "BETON-ARME2",
              description: "Génie Civil - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Ouvrages d'Art",
              code: "OVRG-ART",
              description: "Génie Civil - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Infrastructures Routières",
              code: "ROUTE-VRD",
              description: "Génie Civil - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Projet de Fin d'Études (Génie Civil)",
              code: "PROJ-GRAD-GC",
              description: "Génie Civil - L5",
            },
            // Comptabilite
            {
              school_id: currentSchoolId,
              name: "Comptabilité Générale I (T)",
              code: "COMP-NIV1",
              description: "Comptabilité - D1",
            },
            {
              school_id: currentSchoolId,
              name: "Principes de Marketing (T)",
              code: "MARK-COMP",
              description: "Comptabilité - D1",
            },
            {
              school_id: currentSchoolId,
              name: "Mathématiques Financières (T)",
              code: "MATH-FIN",
              description: "Comptabilité - D1",
            },
            {
              school_id: currentSchoolId,
              name: "Bureautique et Tableurs (T)",
              code: "BURO-INF",
              description: "Comptabilité - D1",
            },
            {
              school_id: currentSchoolId,
              name: "Logiciels de Comptabilité",
              code: "COMP-SAGE",
              description: "Comptabilité - D2",
            },
            {
              school_id: currentSchoolId,
              name: "Fiscalité Haïtienne",
              code: "FISC-HT",
              description: "Comptabilité - D2",
            },
            {
              school_id: currentSchoolId,
              name: "Audit Interne et Contrôle",
              code: "AUDIT-INTERN",
              description: "Comptabilité - D2",
            },
            {
              school_id: currentSchoolId,
              name: "Rapport de Stage",
              code: "PROJ-STAGE-COMP",
              description: "Comptabilité - D2",
            },
            // Technologie Medicale
            {
              school_id: currentSchoolId,
              name: "Hématologie Clinique I",
              code: "HEMATO1",
              description: "Technologie Médicale - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Parasitologie Clinique",
              code: "PARASITO",
              description: "Technologie Médicale - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Microbiologie Médicale I",
              code: "MICROBIO1",
              description: "Technologie Médicale - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Chimie Clinique I",
              code: "CHEM-CLIN1",
              description: "Technologie Médicale - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Hématologie Clinique II",
              code: "HEMATO2",
              description: "Technologie Médicale - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Immunologie/Sérologie",
              code: "IMMUNO",
              description: "Technologie Médicale - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Microbiologie Médicale II",
              code: "MICROBIO2",
              description: "Technologie Médicale - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Immuno-hématologie / Banque de sang",
              code: "SANG-TRANS",
              description: "Technologie Médicale - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Chimie Clinique II",
              code: "CHEM-CLIN2",
              description: "Technologie Médicale - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Biosécurité et Gestion des Déchets",
              code: "LAB-BIOSEC",
              description: "Technologie Médicale - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Assurance Qualité au Laboratoire",
              code: "LAB-QUALITY",
              description: "Technologie Médicale - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Biologie Moléculaire et Diagnostic",
              code: "GENETIQUE",
              description: "Technologie Médicale - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Stage Pratique de Laboratoire",
              code: "LAB-STAGE",
              description: "Technologie Médicale - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Projet d'Intégration d'Expertise",
              code: "LAB-MEMOIRE",
              description: "Technologie Médicale - L4",
            },
            // Médecine Dentaire
            {
              school_id: currentSchoolId,
              name: "Anatomie Dentaire",
              code: "ANAT-DENT",
              description: "Médecine Dentaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Histologie & Embryologie Bucco-dentaire",
              code: "HISTO-EMBRYO",
              description: "Médecine Dentaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Biochimie Médicale",
              code: "BIOCH-MED",
              description: "Médecine Dentaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Physiologie Générale",
              code: "PHYSIO-GEN",
              description: "Médecine Dentaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Odontologie Conservatrice I",
              code: "ODONT-CONS1",
              description: "Médecine Dentaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Prothèse Dentaire I",
              code: "PROTH-DENT1",
              description: "Médecine Dentaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Parodontologie I",
              code: "PARO1",
              description: "Médecine Dentaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Radiologie Buccale",
              code: "RADIO-BUCCAL",
              description: "Médecine Dentaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Pathologie Médicale & Chirurgicale",
              code: "PATH-MED-CHIR",
              description: "Médecine Dentaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Odontologie Conservatrice II",
              code: "ODONT-CONS2",
              description: "Médecine Dentaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Prothèse Dentaire II",
              code: "PROTH-DENT2",
              description: "Médecine Dentaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacologie Dentaire",
              code: "PHARMACO-DENT",
              description: "Médecine Dentaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Chirurgie Buccale & Maxillo-Faciale",
              code: "CHIR-BUCC",
              description: "Médecine Dentaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Orthopédie Dento-Faciale",
              code: "ODF",
              description: "Médecine Dentaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Thérapeutique Endodontique",
              code: "THERAP-ENDO",
              description: "Médecine Dentaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Dentisterie Pédiatrique",
              code: "DENT-PEDIAT",
              description: "Médecine Dentaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Clinique Odontologique Intégrée",
              code: "CLIN-ODONT",
              description: "Médecine Dentaire - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Urgences Bucco-dentaires",
              code: "URG-DENT",
              description: "Médecine Dentaire - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Stage Hospitalier Dentaire",
              code: "STAGE-HOSP-DENT",
              description: "Médecine Dentaire - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Projet de Fin d'Études (Dentaire)",
              code: "PROJ-GRAD-DENT",
              description: "Médecine Dentaire - L5",
            },
            // Médecine Vétérinaire
            {
              school_id: currentSchoolId,
              name: "Anatomie des Animaux Domestiques I",
              code: "ANAT-VET1",
              description: "Médecine Vétérinaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Histologie & Embryologie Vétérinaire",
              code: "HISTO-EMBRYO-VET",
              description: "Médecine Vétérinaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Biochimie Vétérinaire",
              code: "BIOCH-VET",
              description: "Médecine Vétérinaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Physiologie Vétérinaire I",
              code: "PHYSIO-VET1",
              description: "Médecine Vétérinaire - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Microbiologie Vétérinaire",
              code: "MICRO-VET",
              description: "Médecine Vétérinaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Parasitologie Vétérinaire I",
              code: "PARASITO-VET1",
              description: "Médecine Vétérinaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacologie & Toxicologie I",
              code: "PHARMACO-TOX1",
              description: "Médecine Vétérinaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Nutrition Animale",
              code: "NUT-ANIMAL",
              description: "Médecine Vétérinaire - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Pathologie Médicale des Grands Animaux",
              code: "PATH-MED-ANIMAL",
              description: "Médecine Vétérinaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Chirurgie Vétérinaire Générale",
              code: "CHIR-VET-GEN",
              description: "Médecine Vétérinaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Imagerie Médicale Vétérinaire",
              code: "IMAGE-MED-VET",
              description: "Médecine Vétérinaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Épidémiologie Vétérinaire",
              code: "EPIDEMIO-VET",
              description: "Médecine Vétérinaire - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Pathologie des Animaux de Compagnie",
              code: "PATH-COMPAGNY",
              description: "Médecine Vétérinaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Médecine & Chirurgie Équine",
              code: "MED-CHIR-EQUIN",
              description: "Médecine Vétérinaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Reproduction & Obstétrique Animale",
              code: "REPROD-VET",
              description: "Médecine Vétérinaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Inspection des Denrées (Hygiène)",
              code: "INSPECTION-HYG",
              description: "Médecine Vétérinaire - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Clinique Ambulatoire Vétérinaire",
              code: "CLIN-AMB-VET",
              description: "Médecine Vétérinaire - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Santé Publique Vétérinaire",
              code: "PUBLIC-HEALTH-VET",
              description: "Médecine Vétérinaire - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Stage Professionnel Vétérinaire",
              code: "STAGE-CLIN-VET",
              description: "Médecine Vétérinaire - L5",
            },
            {
              school_id: currentSchoolId,
              name: "Rapport d'Expertise Vétérinaire",
              code: "RAPPORT-VET",
              description: "Médecine Vétérinaire - L5",
            },
            // Pharmacologie
            {
              school_id: currentSchoolId,
              name: "Chimie Organique Générale",
              code: "CHEM-ORG",
              description: "Pharmacologie - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Biologie Cellulaire & Physiologie",
              code: "BIOL-CELL",
              description: "Pharmacologie - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacie Galénique I",
              code: "GALENIQUE1",
              description: "Pharmacologie - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Mathématiques & Statistiques Appliquées",
              code: "PHARM-STATS",
              description: "Pharmacologie - L1",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacie Galénique II",
              code: "GALENIQUE2",
              description: "Pharmacologie - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Chimie Thérapeutique I",
              code: "CHEM-THERAP1",
              description: "Pharmacologie - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Biochimie Clinique",
              code: "BIOCHIMIE-PHARM",
              description: "Pharmacologie - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacognosie (Phytothérapie)",
              code: "PHARMACOGNOSIE",
              description: "Pharmacologie - L2",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacocinétique",
              code: "PHARM-KINETICS",
              description: "Pharmacologie - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Chimie Thérapeutique II",
              code: "CHEM-THERAP2",
              description: "Pharmacologie - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacologie Spéciale & Clinique I",
              code: "PHARMACO-SPECIAL1",
              description: "Pharmacologie - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Toxicologie Générale",
              code: "TOX-GEN",
              description: "Pharmacologie - L3",
            },
            {
              school_id: currentSchoolId,
              name: "Pharmacie Clinique & Dispensation",
              code: "PHARM-CLINIC",
              description: "Pharmacologie - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Législation & Déontologie Pharmaceutique",
              code: "PHARM-LAW",
              description: "Pharmacologie - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Stage Pratique en Officine",
              code: "STAGE-OFFICINE",
              description: "Pharmacologie - L4",
            },
            {
              school_id: currentSchoolId,
              name: "Projet de Recherche Pharmaceutique",
              code: "PROJ-GRAD-PHARM",
              description: "Pharmacologie - L4",
            },
            // Informatique de Bureau
            {
              school_id: currentSchoolId,
              name: "Système d'Exploitation & Bureautique",
              code: "INFOB-OS",
              description: "Informatique de Bureau",
            },
            {
              school_id: currentSchoolId,
              name: "Traitement de Texte (Word)",
              code: "INFOB-DOC",
              description: "Informatique de Bureau",
            },
            {
              school_id: currentSchoolId,
              name: "Chiffriers Électroniques (Excel)",
              code: "INFOB-TAB",
              description: "Informatique de Bureau",
            },
            {
              school_id: currentSchoolId,
              name: "Présentation Assistée (PowerPoint)",
              code: "INFOB-PRES",
              description: "Informatique de Bureau",
            },
            {
              school_id: currentSchoolId,
              name: "Bases de Données (Access)",
              code: "INFOB-DB",
              description: "Informatique de Bureau",
            },
            {
              school_id: currentSchoolId,
              name: "Navigation Web & Email",
              code: "INFOB-NET",
              description: "Informatique de Bureau",
            },
            {
              school_id: currentSchoolId,
              name: "Dactylographie",
              code: "INFOB-TYP",
              description: "Informatique de Bureau",
            },
            // Assistance Administrative
            {
              school_id: currentSchoolId,
              name: "Secrétariat et Bureautique Pro",
              code: "ADMIN-SEC",
              description: "Assistance Administrative",
            },
            {
              school_id: currentSchoolId,
              name: "Correspondance Administrative",
              code: "ADMIN-CORR",
              description: "Assistance Administrative",
            },
            {
              school_id: currentSchoolId,
              name: "Classement et Archivage",
              code: "ADMIN-ARCH",
              description: "Assistance Administrative",
            },
            {
              school_id: currentSchoolId,
              name: "Technique d'Accueil & Comm",
              code: "ADMIN-ACC",
              description: "Assistance Administrative",
            },
            {
              school_id: currentSchoolId,
              name: "Gestion du Temps & Agendas",
              code: "ADMIN-TIME",
              description: "Assistance Administrative",
            },
            {
              school_id: currentSchoolId,
              name: "Éléments de Droit du Travail",
              code: "ADMIN-LAW",
              description: "Assistance Administrative",
            },
          ];
        } else if (currentSchoolType === "PROFESSIONAL") {
          standardSubjects = [
            {
              school_id: currentSchoolId,
              name: "Maintenance Matériel",
              code: "MAINT101",
              description: "Centre Professionnel",
            },
            {
              school_id: currentSchoolId,
              name: "Fondamentaux Réseaux",
              code: "RES101",
              description: "Centre Professionnel",
            },
            {
              school_id: currentSchoolId,
              name: "Pratique Plomberie",
              code: "PLOM101",
              description: "Centre Professionnel",
            },
            {
              school_id: currentSchoolId,
              name: "Circuits Électriques",
              code: "ELEC101",
              description: "Centre Professionnel",
            },
            {
              school_id: currentSchoolId,
              name: "Art Culinaire",
              code: "CUIS101",
              description: "Centre Professionnel",
            },
            {
              school_id: currentSchoolId,
              name: "Esthétique",
              code: "ESTH101",
              description: "Centre Professionnel",
            },
            {
              school_id: currentSchoolId,
              name: "Moteurs à Combustion",
              code: "MEC101",
              description: "Centre Professionnel",
            },
          ];
        } else {
          standardSubjects = [
            // Classic School Default
            {
              school_id: currentSchoolId,
              name: "Mathématiques Fondamentales",
              code: "MATH-FOND",
              description: "Arithmétique/Géométrie",
            },
            {
              school_id: currentSchoolId,
              name: "Communication Française",
              code: "FRAN-FOND",
              description: "Grammaire/Conjugaison",
            },
            {
              school_id: currentSchoolId,
              name: "Communication Créole",
              code: "CREO-FOND",
              description: "Langue maternelle",
            },
            {
              school_id: currentSchoolId,
              name: "Sciences Expérimentales",
              code: "SCI-EXP",
              description: "Physique/Chimie/Bio",
            },
            {
              school_id: currentSchoolId,
              name: "Sciences Sociales",
              code: "SCI-SOC",
              description: "Histoire/Géo",
            },
            {
              school_id: currentSchoolId,
              name: "Anglais",
              code: "ANGL-GEN",
              description: "Langue vivante 1",
            },
            {
              school_id: currentSchoolId,
              name: "Informatique",
              code: "INFO-TECH",
              description: "Bureautique",
            },
            {
              school_id: currentSchoolId,
              name: "Éducation Physique",
              code: "EPS-SPORT",
              description: "Sport",
            },
          ];
        }

        const { error: upsertError } = await supabase
          .from("subjects")
          .upsert(standardSubjects, { onConflict: "school_id,code" });
        if (upsertError) throw upsertError;

        // Re-vérification après fallback
        const { data: retrySubs } = await supabase
          .from("subjects")
          .select("id, code")
          .eq("school_id", currentSchoolId);
        if (!retrySubs || retrySubs.length === 0) {
          throw new Error(
            `Les ${terminology.subjects.toLowerCase()} sont créés mais restent invisibles. Veuillez exécuter le script SQL de réparation des permissions (RLS).`,
          );
        }
      }

      // 5. Liaison aux classes
      let currentClassesQuery = supabase
        .from("classes")
        .select("*")
        .eq("school_id", currentSchoolId);

      if (currentCampusId && isValidUuid(currentCampusId)) {
        currentClassesQuery = currentClassesQuery.eq("campus_id", currentCampusId);
      }
      const { data: currentClasses } = await currentClassesQuery;
      const { data: finalSubs } = await supabase
        .from("subjects")
        .select("id, code")
        .eq("school_id", currentSchoolId);

      if (currentClasses && currentClasses.length > 0 && finalSubs) {
        const associationsToInsert: any[] = [];

        // Helper mapping function
        const getIsSubjectMatching = (
          className: string,
          classLevel: string,
          subjectCode: string,
        ): boolean => {
          const normClass = className.toUpperCase();
          const code = subjectCode.toUpperCase();

          // Standard Classic Mapping
          if (classLevel === "MATERNELLE") {
            return [
              "INIT-MATH",
              "LANG-COMM",
              "PSYCHOMOT",
              "ARTS-DESS",
              "EVEIL-SCI",
            ].includes(code);
          }
          if (classLevel === "FONDAMENTALE") {
            return [
              "MATH-FOND",
              "FRAN-FOND",
              "CREO-FOND",
              "SCI-EXP",
              "SCI-SOC",
              "ANGL-GEN",
              "INFO-TECH",
              "EPS-SPORT",
            ].includes(code);
          }
          if (classLevel === "SECONDAIRE") {
            return [
              "MATH-FOND",
              "PHY-CHI-NS",
              "SVT-NS",
              "PHILO",
              "ECONO",
              "LITT-UNIV",
              "ANGL-GEN",
              "ESPA-GEN",
              "INFO-TECH",
            ].includes(code);
          }

          // Common Uni linkages
          const isCommonL1 = ["COM-FR", "ANG-ACAD", "METHOD-RECH"].includes(
            code,
          );
          const isCommonL1Quant = ["MATH-GEN"].includes(code);

          if (isCommonL1) {
            if (
              (normClass.endsWith(" I") || normClass.includes(" I ")) &&
              classLevel === "LICENCE"
            )
              return true;
          }
          if (isCommonL1Quant) {
            if (
              (normClass.endsWith(" I") || normClass.includes(" I ")) &&
              (normClass.includes("INFORM") ||
                normClass.includes("ADMIN") ||
                normClass.includes("GÉNIE") ||
                normClass.includes("GENIE"))
            ) {
              return true;
            }
          }

          // SCIENCES INFORMATIQUES
          if (normClass.includes("INFORM")) {
            if (normClass.endsWith(" I") || normClass.includes(" I ")) {
              return [
                "ALGO101",
                "MATH-DISC",
                "ARCHI-ORD",
                "INTRO-INFO",
              ].includes(code);
            }
            if (normClass.endsWith(" II") || normClass.includes(" II ")) {
              return [
                "PROG-OOP",
                "DBD201",
                "RESEAUX1",
                "STRUC-DAT",
                "COM-FR",
              ].includes(code);
            }
            if (normClass.endsWith(" III") || normClass.includes(" III ")) {
              return ["PROG-WEB", "ING-LOG", "SEC-INF", "SYS-EXPLOIT"].includes(
                code,
              );
            }
            if (normClass.endsWith(" IV") || normClass.includes(" IV ")) {
              return [
                "IA-INTRO",
                "CLOUD-ARCH",
                "PROJ-GRAD-INF",
                "ENTREP-NUM",
              ].includes(code);
            }
          }

          // SCIENCES ADMINISTRATIVES
          if (normClass.includes("ADMINISTR")) {
            if (normClass.endsWith(" I") || normClass.includes(" I ")) {
              return ["COMP-GEN", "MNG101", "INTRO-ECO", "MATH-FIN1"].includes(
                code,
              );
            }
            if (normClass.endsWith(" II") || normClass.includes(" II ")) {
              return [
                "COMP-INTER",
                "MICRO-ECO",
                "MACRO-ECO",
                "MNG-RH",
              ].includes(code);
            }
            if (normClass.endsWith(" III") || normClass.includes(" III ")) {
              return [
                "FIN-CORP",
                "MARKETING",
                "DROIT-AFFAIR",
                "STAT-APPL",
              ].includes(code);
            }
            if (normClass.endsWith(" IV") || normClass.includes(" IV ")) {
              return [
                "STRAT-ORG",
                "COMP-PUBLIC",
                "COMM-INTERN",
                "PROJ-GRAD-ADM",
              ].includes(code);
            }
          }

          // SCIENCES JURIDIQUES
          if (normClass.includes("JURID") || normClass.includes("DROIT")) {
            if (normClass.endsWith(" I") || normClass.includes(" I ")) {
              return [
                "INTRO-DROIT",
                "DROIT-CONST",
                "HIST-DROIT",
                "DROIT-PERS",
              ].includes(code);
            }
            if (normClass.endsWith(" II") || normClass.includes(" II ")) {
              return [
                "DROIT-OBLIG",
                "DROIT-CONST2",
                "DROIT-PENAL",
                "DROIT-ADMIN",
              ].includes(code);
            }
            if (normClass.endsWith(" III") || normClass.includes(" III ")) {
              return [
                "DROIT-TRAV",
                "DROIT-INT-PUB",
                "DROIT-REEL",
                "PROC-CIV",
              ].includes(code);
            }
            if (normClass.endsWith(" IV") || normClass.includes(" IV ")) {
              return [
                "DROIT-INT-PRIV",
                "DROIT-AFFAIR",
                "PROC-PENAL",
                "MEMOIRE-JUR",
              ].includes(code);
            }
          }

          // SCIENCES INFIRMIÈRES
          if (normClass.includes("INFIRM") || normClass.includes("SOINS")) {
            if (normClass.endsWith(" I") || normClass.includes(" I ")) {
              return [
                "ANATOMIE1",
                "NUTRITION",
                "SOINS-FOND",
                "MICRO-PARASIT",
              ].includes(code);
            }
            if (normClass.endsWith(" II") || normClass.includes(" II ")) {
              return [
                "ANATOMIE2",
                "PATHOLOGIE1",
                "SOINS-ADULTE",
                "PHARMACO1",
              ].includes(code);
            }
            if (normClass.endsWith(" III") || normClass.includes(" III ")) {
              return [
                "SOINS-PEDIAT",
                "SOINS-MATERN",
                "ETHIQUE-DEONT",
                "SANTE-COMM",
              ].includes(code);
            }
            if (normClass.endsWith(" IV") || normClass.includes(" IV ")) {
              return [
                "SOINS-PSYCH",
                "GEST-SOINS",
                "RECH-INF",
                "STAGE-INTEG",
              ].includes(code);
            }
          }

          // GÉNIE CIVIL
          if (
            normClass.includes("GÉNIE CIVIL") ||
            normClass.includes("GENIE CIVIL")
          ) {
            if (normClass.endsWith(" I") || normClass.includes(" I ")) {
              return [
                "MATH-GEN",
                "PHY-MECAN",
                "DESSIN-INDA",
                "CHIMIE-GEN",
              ].includes(code);
            }
            if (normClass.endsWith(" II") || normClass.includes(" II ")) {
              return [
                "CALCULU2",
                "STATIQUE",
                "ALGEBRE-LIN",
                "TOPOGRAPH",
              ].includes(code);
            }
            if (normClass.endsWith(" III") || normClass.includes(" III ")) {
              return ["RDM1", "HYDRAU1", "GEOTECH1", "MATER-CONSTR"].includes(
                code,
              );
            }
            if (normClass.endsWith(" IV") || normClass.includes(" IV ")) {
              return [
                "BETON-ARME1",
                "CHARP-MET",
                "DYN-STRUCT",
                "GEST-CHANT",
              ].includes(code);
            }
            if (normClass.endsWith(" V") || normClass.includes(" V ")) {
              return [
                "BETON-ARME2",
                "OVRG-ART",
                "ROUTE-VRD",
                "PROJ-GRAD-GC",
              ].includes(code);
            }
          }

          // COMPTABILITÉ INFORMATISÉE
          if (
            normClass.includes("COMPTABILITÉ INFORMATISÉE") ||
            normClass.includes("COMPTABILITE INFORMATISEE")
          ) {
            if (normClass.endsWith(" I") || normClass.includes(" I ")) {
              return [
                "COMP-NIV1",
                "MARK-COMP",
                "MATH-FIN",
                "BURO-INF",
              ].includes(code);
            }
            if (normClass.endsWith(" II") || normClass.includes(" II ")) {
              return [
                "COMP-SAGE",
                "FISC-HT",
                "AUDIT-INTERN",
                "PROJ-STAGE-COMP",
              ].includes(code);
            }
          }

          // TECHNIQUE DOUANIÈRE
          if (normClass.includes("DOUAN")) {
            if (normClass.endsWith(" I") || normClass.includes(" I ")) {
              return ["INTRO-ECO", "BURO-INF", "COMP-NIV1"].includes(code);
            }
            if (normClass.endsWith(" II") || normClass.includes(" II ")) {
              return ["FISC-HT", "AUDIT-INTERN"].includes(code);
            }
          }

          // TECHNOLOGIE MÉDICALE
          if (
            normClass.includes("TECHNOLOGIE MÉDICALE") ||
            normClass.includes("TECHNOLOGIE MEDICALE")
          ) {
            return [
              "HEMATO1",
              "PARASITO",
              "MICROBIO1",
              "CHEM-CLIN1",
              "HEMATO2",
              "IMMUNO",
              "MICROBIO2",
              "LAB-BIOSEC",
              "SANG-TRANS",
              "CHEM-CLIN2",
              "LAB-QUALITY",
              "GENETIQUE",
              "LAB-STAGE",
              "LAB-MEMOIRE",
              "COM-FR",
              "ANG-ACAD",
              "MATH-GEN",
              "METHOD-RECH",
            ].includes(code);
          }

          // MÉDECINE DENTAIRE
          if (
            normClass.includes("MÉDECINE DENTAIRE") ||
            normClass.includes("MEDECINE DENTAIRE") ||
            normClass.includes("DENTAIRE")
          ) {
            return [
              "ANAT-DENT",
              "HISTO-EMBRYO",
              "BIOCH-MED",
              "PHYSIO-GEN",
              "ODONT-CONS1",
              "PROTH-DENT1",
              "PARO1",
              "RADIO-BUCCAL",
              "PATH-MED-CHIR",
              "ODONT-CONS2",
              "PROTH-DENT2",
              "PHARMACO-DENT",
              "CHIR-BUCC",
              "ODF",
              "THERAP-ENDO",
              "DENT-PEDIAT",
              "CLIN-ODONT",
              "URG-DENT",
              "STAGE-HOSP-DENT",
              "PROJ-GRAD-DENT",
              "COM-FR",
              "ANG-ACAD",
              "MATH-GEN",
              "METHOD-RECH",
            ].includes(code);
          }

          // MÉDECINE VÉTÉRINAIRE
          if (
            normClass.includes("MÉDECINE VÉTÉRINAIRE") ||
            normClass.includes("MEDECINE VETERINAIRE") ||
            normClass.includes("VÉTÉRINAIRE") ||
            normClass.includes("VETERINAIRE")
          ) {
            return [
              "ANAT-VET1",
              "HISTO-EMBRYO-VET",
              "BIOCH-VET",
              "PHYSIO-VET1",
              "MICRO-VET",
              "PARASITO-VET1",
              "PHARMACO-TOX1",
              "NUT-ANIMAL",
              "PATH-MED-ANIMAL",
              "CHIR-VET-GEN",
              "IMAGE-MED-VET",
              "EPIDEMIO-VET",
              "PATH-COMPAGNY",
              "MED-CHIR-EQUIN",
              "REPROD-VET",
              "INSPECTION-HYG",
              "CLIN-AMB-VET",
              "PUBLIC-HEALTH-VET",
              "STAGE-CLIN-VET",
              "RAPPORT-VET",
              "COM-FR",
              "ANG-ACAD",
              "MATH-GEN",
              "METHOD-RECH",
            ].includes(code);
          }

          // PHARMACOLOGIE
          if (
            normClass.includes("PHARMACOLOGIE") ||
            normClass.includes("PHARMACIE")
          ) {
            return [
              "CHEM-ORG",
              "BIOL-CELL",
              "GALENIQUE1",
              "PHARM-STATS",
              "GALENIQUE2",
              "CHEM-THERAP1",
              "BIOCHIMIE-PHARM",
              "PHARMACOGNOSIE",
              "PHARM-KINETICS",
              "CHEM-THERAP2",
              "PHARMACO-SPECIAL1",
              "TOX-GEN",
              "PHARM-CLINIC",
              "PHARM-LAW",
              "STAGE-OFFICINE",
              "PROJ-GRAD-PHARM",
              "COM-FR",
              "ANG-ACAD",
              "MATH-GEN",
              "METHOD-RECH",
            ].includes(code);
          }

          // INFORMATIQUE DE BUREAU
          if (
            normClass.includes("INFORMATIQUE DE BUREAU") ||
            normClass.includes("INFORM. DE BUREAU") ||
            normClass.includes("INFO DE BUREAU") ||
            normClass.includes("BUREAUTIQUE")
          ) {
            return [
              "INFOB-OS",
              "INFOB-DOC",
              "INFOB-TAB",
              "INFOB-PRES",
              "INFOB-DB",
              "INFOB-NET",
              "INFOB-TYP",
              "COM-FR",
              "ANG-ACAD",
            ].includes(code);
          }

          // ASSISTANCE ADMINISTRATIVE
          if (
            normClass.includes("ASSISTANCE ADMINISTRATIVE") ||
            normClass.includes("SECRETARIAT") ||
            normClass.includes("SECRÉTARIAT")
          ) {
            return [
              "ADMIN-SEC",
              "ADMIN-CORR",
              "ADMIN-ARCH",
              "ADMIN-ACC",
              "ADMIN-TIME",
              "ADMIN-LAW",
              "COM-FR",
              "ANG-ACAD",
            ].includes(code);
          }

          // CUISINE / RESTAURATION
          if (
            normClass.includes("CUISINE") ||
            normClass.includes("RESTAUR") ||
            normClass.includes("PÂTISS") ||
            normClass.includes("PATISS")
          ) {
            return [
              "CUIS-101",
              "BAR-REST",
              "PATISS-101",
              "HYG-ALIM",
              "OENO-101",
              "COMP-SIMPL",
              "ENTREP-PRO",
            ].includes(code);
          }

          // BEAUTÉ / ESTHÉTIQUE
          if (
            normClass.includes("ESTHÉT") ||
            normClass.includes("ESTHET") ||
            normClass.includes("COIFF") ||
            normClass.includes("MAQUI") ||
            normClass.includes("BEAUT")
          ) {
            return [
              "ESTH101",
              "CHEF-COIF",
              "MAQ-PEAU",
              "ONGLE",
              "COMP-SIMPL",
              "ENTREP-PRO",
            ].includes(code);
          }

          // ÉLECTRICITÉ
          if (normClass.includes("ÉLECTR") || normClass.includes("ELECTR")) {
            return ["ELEC-BAT", "ELEC-IND", "COMP-SIMPL", "ENTREP-PRO"].includes(code);
          }

          // PLOMBERIE
          if (normClass.includes("PLOMB")) {
            return ["PLOM101", "COMP-SIMPL", "ENTREP-PRO"].includes(code);
          }

          // CLIMATISATION
          if (
            normClass.includes("CLIMAT") ||
            normClass.includes("FROID") ||
            normClass.includes("REFRI")
          ) {
            return ["CLIM-REF", "COMP-SIMPL", "ENTREP-PRO"].includes(code);
          }

          // MÉCANIQUE
          if (
            normClass.includes("MÉCAN") ||
            normClass.includes("MECAN") ||
            normClass.includes("DIAG") ||
            normClass.includes("AUTO")
          ) {
            return ["MEC101", "AUTO-DIAG", "AUTO-MECA", "COMP-SIMPL", "ENTREP-PRO"].includes(code);
          }

          // COUTURE
          if (
            normClass.includes("COUTUR") ||
            normClass.includes("STYLE") ||
            normClass.includes("STYLIS") ||
            normClass.includes("MODEL")
          ) {
            return ["COUT-101", "STYL-101", "COMP-SIMPL", "ENTREP-PRO"].includes(code);
          }

          // INFORMATIQUE & SECRETARIAT / ADMINISTRATION / BUREAUTIQUE
          if (
            normClass.includes("ADMINI") ||
            normClass.includes("SECRÉ") ||
            normClass.includes("SECRE") ||
            normClass.includes("BUREAU")
          ) {
            return ["BURO-SEC", "EXCEL-PRO", "COMP-SIMPL", "ENTREP-PRO"].includes(code);
          }

          // NETWORKING / GRAPHICS / DEVELOPPEMENT
          if (
            normClass.includes("RÉSEAU") ||
            normClass.includes("RESEAU") ||
            normClass.includes("WEB") ||
            normClass.includes("GRAPHIS") ||
            normClass.includes("DEVELOPP")
          ) {
            return [
              "MAINT101",
              "RES101",
              "WEB-INIT",
              "COMP-SIMPL",
              "ENTREP-PRO",
            ].includes(code);
          }

          return false;
        };

        currentClasses.forEach((cls) => {
          finalSubs.forEach((sub) => {
            if (getIsSubjectMatching(cls.name, cls.level, sub.code)) {
              let coef = getCollegeInnovationsDefaultCoefficient(cls.level, sub.code);
              associationsToInsert.push({
                class_id: cls.id,
                subject_id: sub.id,
                coefficient: coef,
                school_id: currentSchoolId,
              });
            }
          });
        });

        if (associationsToInsert.length > 0) {
          await supabase
            .from("class_subjects")
            .upsert(associationsToInsert, {
              onConflict: "class_id,subject_id",
            });
        }
      }

      AuditLogger.log({
        school_id: currentSchoolId,
        user_id: user.id,
        action: "CREATE",
        entity_type: "settings",
        details: { type: "seed_subjects" },
      });

      setNotification({
        type: "success",
        message: "Catalogue synchronisé et lié avec succès !",
      });
      await fetchData();
    } catch (err: any) {
      console.error("Seed Error:", err);
      setNotification({
        type: "error",
        message: err.message || "Erreur lors de l'injection.",
      });
    } finally {
      setIsSeeding(false);
      setTimeout(() => setNotification(null), 8000);
    }
  };

  const handleRepairSession = () => {
    setConfirmModal({
      isOpen: true,
      type: "migrate",
      id: "repair-action",
      title: "Réparation Profonde",
      message: `Cela va tenter d'unifier tous(tes) vos ${terminology.classes.toLowerCase()} et ${terminology.subjects.toLowerCase()} sous votre ID unique. Utilisez cette option si vos données sont invisibles.`,
      error: null,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-500 font-medium animate-pulse">
          Chargement académique...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <header className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Structure Académique
          </h2>
          <p className="text-gray-500 mt-1 text-sm">
            Gestion des {terminology.classes} & {terminology.subjects}
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative group flex-1 md:flex-none">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Rechercher..."
              className="pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64 shadow-sm text-sm transition-shadow"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchData}
            className="p-2 bg-white text-gray-500 rounded-lg hover:text-blue-600 hover:bg-blue-50 border border-gray-300 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${notification.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <p className="font-medium text-sm">{notification.message}</p>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto p-1.5 hover:bg-black/5 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 w-full overflow-x-auto custom-scrollbar">
        {[
          { id: "classes", label: terminology.classes, icon: GraduationCap },
          {
            id: "subjects",
            label: `${terminology.subjects} Globales`,
            icon: BookOpen,
          },
          {
            id: "matrix",
            label: `Plan par ${terminology.class}`,
            icon: Layers,
          },
          {
            id: "dashboard",
            label: "Tableau de Bord",
            icon: Sparkles,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700 bg-blue-50/40 shadow-inner hover:bg-blue-50/50"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50/70"
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "classes" && (
          <div className="space-y-8">
            <div className="flex bg-gray-100 p-1 rounded-lg w-full max-w-3xl mx-auto mb-6 overflow-x-auto custom-scrollbar animate-in fade-in duration-350">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAcademicTab(tab)}
                  className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold rounded-md transition-all ${
                    academicTab === tab
                      ? "bg-white text-blue-600 shadow-sm border border-gray-100"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "Tous les cycles" ? (
                    <Layers size={16} />
                  ) : (
                    <GraduationCap size={16} />
                  )}
                  <span className="whitespace-nowrap">{tab}</span>
                </button>
              ))}
            </div>

            {(() => {
              const groupedAll = getGroupedClasses(classes, academicTab) || {};
              const groupedFiltered = getGroupedClasses(filteredClasses, academicTab) || {};
              const disciplines = Object.keys(groupedAll);

              const renderGrids = () => (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
                  {Object.entries(groupedFiltered)
                    .filter(
                      ([groupName]) => cycleTab === "Tous" || cycleTab === groupName,
                    )
                    .filter(([_, groupClasses]) => groupClasses.length > 0)
                    .map(([groupName, groupClasses]) => (
                      <div key={groupName} className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
                          <h3 className="text-lg font-extrabold text-gray-800">
                            {groupName}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shadow-sm">
                            {groupClasses.length} {terminology.classes}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {groupClasses.map((cls) => {
                            const classAssocs = associations.filter((a) => a.class_id === cls.id);
                            const totalCoef = classAssocs.reduce(
                              (sum, a) => sum + (Number(a.coefficient) || 1),
                              0
                            );
                            const studentCount = cls.students_count || 0;

                            return (
                              <div
                                key={cls.id}
                                className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[250px]"
                              >
                                <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-blue-500/5 to-indigo-500/10 rounded-full -mr-14 -mt-14 pointer-events-none group-hover:scale-125 transition-transform duration-300"></div>

                                <div className="relative z-10 flex flex-col h-full justify-between flex-1">
                                  <div>
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <GraduationCap size={20} />
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {studentCount > 0 ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                            <Users size={12} />
                                            {studentCount} {academicTab === "Universitaire" ? "étudiant(s)" : academicTab === "Professionnelle" ? "apprenant(s)" : "élève(s)"}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                            Structure active
                                          </span>
                                        )}

                                        {(user.role === UserRole.SUPER_ADMIN ||
                                          user.role === UserRole.SCHOOL_ADMIN ||
                                          user.role === UserRole.DIRECTOR) && (
                                          <div className="flex gap-1 ml-1 md:opacity-80 md:group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={() =>
                                                navigate(`/classes/modifier/${cls.id}`)
                                              }
                                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                              title="Modifier la structure"
                                            >
                                              <Edit2 size={15} />
                                            </button>
                                            <button
                                              onClick={() =>
                                                triggerDeleteClass(cls.id, cls.name)
                                              }
                                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                              title={`Supprimer ce/cette ${terminology.class.toLowerCase()}`}
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <h4 className="text-base font-bold text-gray-900 leading-tight flex flex-wrap items-center gap-1.5 mb-4">
                                      <span>{formatDisciplineName(cls.name)}</span>
                                      {getRomanSuffix(cls.name) && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100/85 text-blue-800 border border-blue-200">
                                          Niveau {getRomanSuffix(cls.name)}
                                        </span>
                                      )}
                                    </h4>

                                    <div className="space-y-2 text-xs">
                                      {/* Programme & Coefs */}
                                      <div className="flex items-center justify-between p-2.5 bg-indigo-50/40 rounded-lg border border-indigo-100">
                                        <div className="flex items-center gap-2">
                                          <BookOpen size={15} className="text-indigo-600" />
                                          <span className="font-semibold text-indigo-900">
                                            {terminology.subjects}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-2xs">
                                            {cls.subjects_count || 0} matière(s)
                                          </span>
                                          {totalCoef > 0 && (
                                            <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                                              {academicTab === "Universitaire" ? `${totalCoef} ECTS` : `Coef. ${totalCoef}`}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Professeur Titulaire */}
                                      <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2">
                                          <UserCheck size={15} className="text-gray-500" />
                                          <span className="font-semibold text-gray-600">
                                            {academicTab === "Universitaire" ? "Resp. Niveau" : "Titulaire"}
                                          </span>
                                        </div>
                                        <span className={`font-bold text-[11px] truncate max-w-[130px] ${cls.teacher_name ? "text-gray-900" : "text-gray-400 italic font-normal"}`}>
                                          {cls.teacher_name || "Non attribué"}
                                        </span>
                                      </div>

                                      {/* Salle / Local */}
                                      {cls.room && (
                                        <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg border border-gray-100">
                                          <div className="flex items-center gap-2">
                                            <Building2 size={15} className="text-gray-500" />
                                            <span className="font-semibold text-gray-600">Salle / Local</span>
                                          </div>
                                          <span className="font-bold text-[11px] text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                                            {cls.room}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => {
                                      setActiveTab("matrix");
                                      window.scrollTo({ top: 300, behavior: "smooth" });
                                    }}
                                    className="w-full py-2.5 mt-4 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors shadow-xs flex items-center justify-center gap-2 group/btn"
                                  >
                                    <BookOpen size={14} className="group-hover/btn:scale-110 transition-transform" />
                                    <span>Gérer le Programme & Cours</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {(user.role === UserRole.SUPER_ADMIN ||
                            user.role === UserRole.SCHOOL_ADMIN ||
                            user.role === UserRole.DIRECTOR) && (
                            <button
                              onClick={() =>
                                navigate(`/classes/ajouter?type=${academicTab}`)
                              }
                              className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 transition-all min-h-[240px] group"
                            >
                              <Plus
                                size={32}
                                className="mb-2 group-hover:scale-110 transition-transform text-gray-400 group-hover:text-blue-600"
                              />
                              <span className="font-bold text-xs text-center leading-normal">
                                Nouvelle Niveau / Promotion
                                <br />
                                <span className="text-[10px] font-medium text-gray-500 group-hover:text-blue-500">
                                  ({groupName.replace("Cycle: ", "")})
                                </span>
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                  {/* If no classes yet, show global add button */}
                  {Object.entries(groupedFiltered)
                    .filter(
                      ([groupName]) => cycleTab === "Tous" || cycleTab === groupName,
                    )
                    .every(([_, g]) => g.length === 0) &&
                    (user.role === UserRole.SUPER_ADMIN ||
                      user.role === UserRole.SCHOOL_ADMIN ||
                      user.role === UserRole.DIRECTOR) && (
                      <button
                        onClick={() =>
                          navigate(`/classes/ajouter?type=${academicTab}`)
                        }
                        className="bg-gray-50 w-full md:w-1/2 border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all min-h-[240px] group mx-auto"
                      >
                        <Plus
                          size={40}
                          className="mb-3 group-hover:scale-110 transition-transform"
                        />
                        <span className="font-bold text-sm">
                          Créer {terminology.class} ({academicTab}
                          {cycleTab !== "Tous" &&
                          ["Universitaire", "Professionnelle"].includes(academicTab)
                            ? ` - ${cycleTab.replace("Cycle: ", "")}`
                            : ""}
                          )
                        </span>
                      </button>
                    )}
                </div>
              );

              if (["Universitaire", "Professionnelle"].includes(academicTab) && disciplines.length > 0) {
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                    {/* Left Pane: beautiful vertical list sidebar of disciplines */}
                    <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-1.5 mb-3 px-1.5 justify-between">
                          <div className="flex items-center gap-1.5">
                            <Filter size={14} className="text-gray-500" />
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Filières & Disciplines
                            </h4>
                          </div>
                        </div>
                        
                        {/* Desktop sidebar list with scroll container */}
                        <div className="hidden lg:flex flex-col gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                          {disciplines.map((discName) => {
                            const isActive = cycleTab === discName;
                            const count = groupedAll[discName]?.length || 0;
                            return (
                              <div
                                key={discName}
                                className={`group/item w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                                  isActive
                                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2 shadow-sm"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/70 border-l-4 border-transparent"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setCycleTab(discName)}
                                  className="text-left flex-1 font-bold text-xs leading-snug outline-none cursor-pointer pr-1"
                                  title={discName}
                                >
                                  {discName}
                                </button>
                                
                                <div className="flex items-center gap-1.5">
                                  {(user.role === UserRole.SUPER_ADMIN ||
                                    user.role === UserRole.SCHOOL_ADMIN ||
                                    user.role === UserRole.DIRECTOR) && (
                                    <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-all">
                                      {school?.has_multi_campus && isSiegeActive && campuses && campuses.length > 1 && (
                                        <button
                                          type="button"
                                          title="Injecter à d'autres annexes"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setInjectModal({
                                              isOpen: true,
                                              disciplineName: discName,
                                              selectedCampusIds: [],
                                              isSubmitting: false,
                                              success: null,
                                              error: null,
                                            });
                                          }}
                                          className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                        >
                                          <Send size={12} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        title="Modifier le nom de la filière"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDisciplineActionModal({
                                            isOpen: true,
                                            type: "rename",
                                            disciplineName: discName,
                                            newName: discName,
                                            isSubmitting: false,
                                            error: null,
                                          });
                                        }}
                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Déplacer vers une autre division"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDisciplineActionModal({
                                            isOpen: true,
                                            type: "move",
                                            disciplineName: discName,
                                            newName: "",
                                            targetDivision: academicTab === "Universitaire" ? "Professionnelle" : "Universitaire",
                                            isSubmitting: false,
                                            error: null,
                                          });
                                        }}
                                        className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                      >
                                        <ArrowLeftRight size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Supprimer la filière et ses niveaux"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDisciplineActionModal({
                                            isOpen: true,
                                            type: "delete",
                                            disciplineName: discName,
                                            newName: "",
                                            isSubmitting: false,
                                            error: null,
                                          });
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-650 hover:bg-red-50 rounded transition-colors"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold flex-shrink-0 ${isActive ? "bg-blue-200/80 text-blue-800" : "bg-gray-100 text-gray-500"}`}>
                                    {count} Lvl
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Quick Action Button within Sidebar for mobile and desktop */}
                        {(user.role === UserRole.SUPER_ADMIN ||
                          user.role === UserRole.SCHOOL_ADMIN ||
                          user.role === UserRole.DIRECTOR) && (
                          <div className="mt-3 pt-3 border-t border-gray-100 hidden lg:block">
                            <button
                              onClick={() => navigate(`/classes/ajouter?type=${academicTab}`)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-150 text-blue-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                            >
                              <Plus size={13} />
                              Ajouter filière / {terminology.class.toLowerCase()}
                            </button>
                          </div>
                        )}

                        {/* Mobile view select dropdown */}
                        <div className="lg:hidden space-y-2">
                          <div className="relative">
                            <select
                              value={cycleTab}
                              onChange={(e) => setCycleTab(e.target.value)}
                              className="w-full pl-3 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 appearance-none shadow-sm cursor-pointer"
                            >
                              {disciplines.map((discName) => (
                                <option key={discName} value={discName}>
                                  {discName} ({groupedAll[discName]?.length || 0} niveaux)
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                              <ChevronDown size={16} />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Right Pane: dynamic grids details list */}
                    <div className="lg:col-span-3">
                      {renderGrids()}
                    </div>
                  </div>
                );
              }

              // Standard classic simple layout
              return renderGrids();
            })()}
          </div>
        )}

        {activeTab === "subjects" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden transition-all">
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <BookOpen size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      Catalogue Global
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                      {filteredSubjects.length} {filteredSubjects.length > 1 ? `${terminology.subject.toLowerCase()}s` : terminology.subject.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">
                    Répertoire centralisé des matières enseignées dans l'établissement
                  </p>
                </div>
              </div>
              {(user.role === UserRole.SUPER_ADMIN ||
                user.role === UserRole.SCHOOL_ADMIN ||
                user.role === UserRole.DIRECTOR) && (
                <button
                  onClick={() => navigate("/matieres/ajouter")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus size={18} />
                  <span>Créer {terminology.subject} globale</span>
                </button>
              )}
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200/80">
                    <th scope="col" className="px-6 py-4">
                      Intitulé de la {terminology.subject}
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Description / Objectifs
                    </th>
                    {(user.role === UserRole.SUPER_ADMIN ||
                      user.role === UserRole.SCHOOL_ADMIN ||
                      user.role === UserRole.DIRECTOR) && (
                      <th scope="col" className="px-6 py-4 text-center w-36">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/80">
                  {filteredSubjects.map((s) => (
                    <tr
                      key={s.id}
                      className="group hover:bg-indigo-50/40 transition-colors duration-150"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-gray-900 block group-hover:text-indigo-900 transition-colors">
                              {s.name}
                            </span>
                            <span className="text-[11px] font-mono text-gray-400 group-hover:text-indigo-600 transition-colors">
                              Code : {s.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 max-w-[320px]">
                        {s.description ? (
                          <span className="line-clamp-2">{s.description}</span>
                        ) : (
                          <span className="text-gray-400 italic">Aucune description renseignée</span>
                        )}
                      </td>
                      {(user.role === UserRole.SUPER_ADMIN ||
                        user.role === UserRole.SCHOOL_ADMIN ||
                        user.role === UserRole.DIRECTOR) && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                navigate(`/matieres/ajouter?id=${s.id}`)
                              }
                              className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                              title="Modifier la matière"
                              aria-label={`Modifier ${s.name}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => triggerDeleteSubject(s.id, s.name)}
                              className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                              title="Supprimer la matière"
                              aria-label={`Supprimer ${s.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredSubjects.length === 0 && (
                    <tr>
                      <td
                        colSpan={
                          user.role === UserRole.SUPER_ADMIN ||
                          user.role === UserRole.SCHOOL_ADMIN ||
                          user.role === UserRole.DIRECTOR
                            ? 3
                            : 2
                        }
                        className="py-16 text-center"
                      >
                        <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
                          <div className="p-4 bg-gray-100 rounded-full text-gray-400">
                            <AlertCircle size={32} />
                          </div>
                          <p className="text-gray-600 font-semibold text-sm">
                            Aucun(e) {terminology.subject.toLowerCase()}{" "}
                            trouvé(e)
                          </p>
                          <p className="text-xs text-gray-400">
                            Créez votre première matière globale pour l'affecter ensuite aux classes.
                          </p>
                          {user.role === UserRole.SUPER_ADMIN && (
                            <button
                              onClick={handleSeedSubjects}
                              className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-2xs"
                            >
                              Injecter le catalogue standard
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "matrix" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex bg-gray-100 p-1 rounded-lg w-full max-w-3xl mx-auto mb-6 overflow-x-auto custom-scrollbar">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAcademicTab(tab)}
                  className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold rounded-md transition-all ${
                    academicTab === tab
                      ? "bg-white text-blue-600 shadow-sm border border-gray-100"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "Tous les cycles" ? (
                    <Layers size={16} />
                  ) : (
                    <GraduationCap size={16} />
                  )}
                  <span className="whitespace-nowrap">{tab}</span>
                </button>
              ))}
            </div>

            {(() => {
              const groupedAll = getGroupedClasses(classes, academicTab) || {};
              const groupedFiltered = getGroupedClasses(filteredClasses, academicTab) || {};
              const disciplines = Object.keys(groupedAll);

              const renderGrids = () => (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
                  {Object.entries(groupedFiltered)
                    .filter(
                      ([groupName]) => cycleTab === "Tous" || cycleTab === groupName,
                    )
                    .filter(([_, groupClasses]) => groupClasses.length > 0)
                    .map(([groupName, groupClasses]) => (
                      <div key={groupName} className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
                          <h3 className="text-lg font-extrabold text-gray-800">
                            {groupName}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shadow-sm">
                            {groupClasses.length} {terminology.classes}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {groupClasses.map((cls) => (
                            <div
                              key={cls.id}
                              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="px-6 py-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between group-hover:bg-blue-50/50 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center font-bold text-lg text-gray-700 shadow-sm group-hover:text-blue-600 group-hover:border-blue-200">
                                      {formatDisciplineName(cls.name).charAt(0)}
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                      <h4 className="text-base font-bold text-gray-900 leading-tight">
                                        {formatDisciplineName(cls.name)}
                                      </h4>
                                      {getRomanSuffix(cls.name) && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100/85 text-blue-800 border border-blue-200">
                                          Niveau {getRomanSuffix(cls.name)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-white px-3 py-1.5 rounded-md text-xs font-semibold text-gray-600 border border-gray-200 shadow-sm">
                                    {cls.subjects_count}{" "}
                                    {terminology.subjects.toLowerCase()}
                                  </div>
                                </div>

                                <div className="p-6 space-y-4">
                                  <div className="flex items-center gap-2 text-gray-800 font-bold text-xs uppercase tracking-wider mb-2">
                                    <BookOpen size={15} className="text-blue-600" />
                                    <span>
                                      {academicTab === "Universitaire"
                                        ? "Maquette Pédagogique & Unités d'Enseignement (UE)"
                                        : academicTab === "Professionnelle"
                                          ? "Modules de Formation & Compétences"
                                          : "Matières & Programme d'Études"}
                                    </span>
                                  </div>
                                  <div className="space-y-2 max-h-[290px] overflow-y-auto custom-scrollbar pr-1">
                                    {associations.filter((a) => a.class_id === cls.id)
                                      .length === 0 ? (
                                      <div className="py-10 text-center border-2 border-dashed border-gray-150 rounded-xl text-gray-400 font-medium text-xs flex flex-col items-center justify-center gap-3 bg-gray-50/50">
                                        <AlertCircle
                                          size={20}
                                          className="opacity-40"
                                        />
                                        Configuration Manquante
                                      </div>
                                    ) : (
                                      associations
                                        .filter((a) => a.class_id === cls.id)
                                        .map((a) => (
                                          <div
                                            key={a.id}
                                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-gray-200/80 rounded-xl hover:bg-gray-50 hover:border-blue-200 transition-all group/item gap-3 sm:gap-2 ${isDeleting === a.id ? "opacity-50" : ""}`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center font-bold text-xs ">
                                                {a.subject?.code?.substring(0, 3)}
                                              </div>
                                              <div>
                                                <p className="text-xs font-bold text-gray-900 leading-tight">
                                                  {a.subject?.name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                  <p className="text-[10px] text-gray-500 font-mono">
                                                    Code: {a.subject?.code}
                                                  </p>
                                                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                  <p className="text-[10px] font-bold text-emerald-600">
                                                    Coef: {a.coefficient}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                            {(user.role === UserRole.SUPER_ADMIN ||
                                              user.role === UserRole.SCHOOL_ADMIN ||
                                              user.role === UserRole.DIRECTOR) && (
                                              <div className="flex items-center gap-1 md:opacity-0 md:group-hover/item:opacity-100 transition-opacity">
                                                <button
                                                  onClick={() =>
                                                    setEditCoefModal({
                                                      isOpen: true,
                                                      assocId: a.id,
                                                      subjectName: a.subject?.name || "Matière",
                                                      className: cls.name,
                                                      coefficient: a.coefficient || 1,
                                                      isSaving: false,
                                                    })
                                                  }
                                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                                                  title="Modifier le coefficient"
                                                >
                                                  <Edit2 size={14} />
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    triggerDeleteAssociation(
                                                      a.id,
                                                      a.subject?.name || "",
                                                      formatDisciplineName(cls.name),
                                                    )
                                                  }
                                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                  title={`Retirer de/du ${terminology.class.toLowerCase()}`}
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        ))
                                    )}
                                  </div>
                                </div>
                              </div>

                              {(user.role === UserRole.SUPER_ADMIN ||
                                user.role === UserRole.SCHOOL_ADMIN ||
                                user.role === UserRole.DIRECTOR) && (
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex justify-center">
                                  <button
                                    onClick={() =>
                                      navigate(`/classes/${cls.id}/matieres`)
                                    }
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 hover:underline"
                                  >
                                    <Plus size={14} /> Gérer {terminology.subjects.toLowerCase()} et coefficients
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                  {Object.entries(groupedFiltered)
                    .filter(
                      ([groupName]) => cycleTab === "Tous" || cycleTab === groupName,
                    )
                    .every(([_, g]) => g.length === 0) && (
                    <div className="py-20 text-center flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <AlertCircle size={48} className="text-gray-300 mb-4" />
                      <p className="text-gray-500 font-medium">
                        Aucun(e) {terminology.class.toLowerCase()} trouvé(e) pour
                        la catégorie {academicTab}
                        {cycleTab !== "Tous" &&
                        ["Universitaire", "Professionnelle"].includes(academicTab)
                          ? ` - ${cycleTab.replace("Cycle: ", "")}`
                          : ""}
                        .
                      </p>
                      {(user.role === UserRole.SUPER_ADMIN ||
                        user.role === UserRole.SCHOOL_ADMIN ||
                        user.role === UserRole.DIRECTOR) && (
                        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                          <button
                            onClick={() =>
                              navigate(`/classes/ajouter?type=${academicTab}`)
                            }
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                          >
                            <Plus size={16} /> Ajouter {terminology.class} (
                            {academicTab})
                          </button>

                          {user.role === UserRole.SUPER_ADMIN && (school?.school_type === "UNIVERSITY" || school?.school_type === "PROFESSIONAL") && (
                              <button
                                onClick={handleSeedSpecialDisciplines}
                                disabled={isSeeding}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                {isSeeding ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Sparkles size={16} />
                                )}
                                Ajouter les Disciplines Standards
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );

              if (["Universitaire", "Professionnelle"].includes(academicTab) && disciplines.length > 0) {
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                    {/* Left Pane Sidebar */}
                    <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 animate-in fade-in duration-200">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-1.5 mb-3 px-1.5">
                          <Filter size={14} className="text-gray-500" />
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Filières & Disciplines
                          </h4>
                        </div>

                        {/* Desktop view with scroll container */}
                        <div className="hidden lg:flex flex-col gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                          {disciplines.map((discName) => {
                            const isActive = cycleTab === discName;
                            const count = groupedAll[discName]?.length || 0;
                            return (
                              <div
                                key={discName}
                                className={`group/item w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                                  isActive
                                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 pl-2 shadow-sm"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/70 border-l-4 border-transparent"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setCycleTab(discName)}
                                  className="text-left flex-1 font-bold text-xs leading-snug outline-none cursor-pointer pr-1"
                                  title={discName}
                                >
                                  {discName}
                                </button>
                                
                                <div className="flex items-center gap-1.5">
                                  {(user.role === UserRole.SUPER_ADMIN ||
                                    user.role === UserRole.SCHOOL_ADMIN ||
                                    user.role === UserRole.DIRECTOR) && (
                                    <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-all">
                                      <button
                                        type="button"
                                        title="Modifier le nom de la filière"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDisciplineActionModal({
                                            isOpen: true,
                                            type: "rename",
                                            disciplineName: discName,
                                            newName: discName,
                                            isSubmitting: false,
                                            error: null,
                                          });
                                        }}
                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Déplacer vers une autre division"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDisciplineActionModal({
                                            isOpen: true,
                                            type: "move",
                                            disciplineName: discName,
                                            newName: "",
                                            targetDivision: academicTab === "Universitaire" ? "Professionnelle" : "Universitaire",
                                            isSubmitting: false,
                                            error: null,
                                          });
                                        }}
                                        className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                      >
                                        <ArrowLeftRight size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Supprimer la filière et ses niveaux"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDisciplineActionModal({
                                            isOpen: true,
                                            type: "delete",
                                            disciplineName: discName,
                                            newName: "",
                                            isSubmitting: false,
                                            error: null,
                                          });
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-650 hover:bg-red-50 rounded transition-colors"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold flex-shrink-0 ${isActive ? "bg-blue-200/80 text-blue-800" : "bg-gray-100 text-gray-500"}`}>
                                    {count} Lvl
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Quick Action Button within Sidebar for matrix tab */}
                        {(user.role === UserRole.SUPER_ADMIN ||
                          user.role === UserRole.SCHOOL_ADMIN ||
                          user.role === UserRole.DIRECTOR) && (
                          <div className="mt-3 pt-3 border-t border-gray-100 hidden lg:block">
                            <button
                              onClick={() => navigate(`/classes/ajouter?type=${academicTab}`)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-150 text-blue-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                            >
                              <Plus size={13} />
                              Ajouter filière / {terminology.class.toLowerCase()}
                            </button>
                          </div>
                        )}

                        {/* Mobile view select dropdown */}
                        <div className="lg:hidden space-y-2">
                          <div className="relative">
                            <select
                              value={cycleTab}
                              onChange={(e) => setCycleTab(e.target.value)}
                              className="w-full pl-3 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 appearance-none shadow-sm cursor-pointer"
                            >
                              {disciplines.map((discName) => (
                                <option key={discName} value={discName}>
                                  {discName} ({groupedAll[discName]?.length || 0} niveaux)
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                              <ChevronDown size={16} />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Right Pane */}
                    <div className="lg:col-span-3">
                      {renderGrids()}
                    </div>
                  </div>
                );
              }

              return renderGrids();
            })()}
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-350">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {terminology.classes} Actives
                  </h4>
                  <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {terminology.subjects} Enregistrés
                  </h4>
                  <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-violet-50 text-violet-600 rounded-lg">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Type de Session
                  </h4>
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {school?.school_type === "UNIVERSITY"
                      ? "Universitaire"
                      : school?.school_type === "PROFESSIONAL"
                        ? "Professionnelle / Technique"
                        : "Classique"}
                  </p>
                </div>
              </div>
            </div>

            {/* Bento Grid Tools */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-950 flex items-center gap-2">
                  <Sparkles size={20} className="text-blue-500 animate-pulse" />
                  Tableau de Bord Académique & Outils de Session
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Gérez la cohérence de vos {terminology.classes.toLowerCase()} et {terminology.subjects.toLowerCase()}, l'intégration automatisée des programmes et la maintenance de votre structure académique.
                </p>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
                
                {/* CARD 1: Réparer la session (Administrateurs uniquement) */}
                {(user.role === UserRole.SUPER_ADMIN ||
                  user.role === UserRole.SCHOOL_ADMIN ||
                  user.role === UserRole.DIRECTOR ||
                  user.is_super_admin) && (
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                          <RefreshCw size={18} />
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-sm">
                          Réparation Profonde & Cohérence
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Si vous faites face à des {terminology.subjects.toLowerCase()} invisibles, des {terminology.options.toLowerCase()} vides ou des anomalies de liaison de {terminology.academicYears.toLowerCase()}, cet outil unifie automatiquement toutes les structures orphelines sous votre ID établissement unique. (Sûr et non-destructif)
                      </p>
                    </div>
                    <div className="mt-5">
                      <button
                        onClick={handleRepairSession}
                        disabled={isMigrating}
                        className="w-full py-2 px-4 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-750 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <RefreshCw
                          size={13}
                          className={isMigrating ? "animate-spin text-red-500" : ""}
                        />
                        Réparer la Session
                      </button>
                    </div>
                  </div>
                )}

                {/* CARD 2: Injecter les standards */}
                {(user.role === UserRole.SUPER_ADMIN || user.is_super_admin) && (
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <BookOpen size={18} />
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-sm">
                          {terminology.subjects} Standards
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        {school?.school_type === "UNIVERSITY"
                          ? `Injectez d'un clic le catalogue complet des ${terminology.subjects.toLowerCase()} et unités d'enseignement officielles de référence.`
                          : school?.school_type === "PROFESSIONAL"
                          ? `Injectez d'un clic le catalogue complet de ${terminology.subjects.toLowerCase()} et modules de référence officiels (Cuisine, Électricité, Mécanique, Couture, Beauté...). Évite les saisies manuelles.`
                          : `Injectez d'un clic le catalogue complet des ${terminology.subjects.toLowerCase()} de référence officiels (Mathématiques, Sciences, Langues, Histoire-Géo, Philosophie, etc.). Évite les saisies manuelles.`}
                      </p>
                    </div>
                    <div className="mt-5">
                      <button
                        onClick={handleSeedSubjects}
                        disabled={isSeeding}
                        className={`w-full py-2 px-4 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                          subjects.length === 0
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80"
                            : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {isSeeding ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {subjects.length === 0 ? "Injecter Standards" : "Compléter Standards"}
                      </button>
                    </div>
                  </div>
                )}

                {/* CARD 3: Multiplier les départements et filières standards (Seulement pour Univ/Pro) */}
                {(user.role === UserRole.SUPER_ADMIN || user.is_super_admin) &&
                  (school?.school_type === "UNIVERSITY" || school?.school_type === "PROFESSIONAL") && (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Layers size={18} />
                          </div>
                          <h4 className="font-extrabold text-gray-900 text-sm">
                            Génération de Cursus Standards
                          </h4>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          Générez automatiquement les cursus et {terminology.options.toLowerCase()} de référence complète adaptés aux diplômes de votre établissement.
                        </p>
                      </div>
                      <div className="mt-5">
                        <button
                          onClick={handleSeedSpecialDisciplines}
                          disabled={isSeeding}
                          className="w-full py-2 px-4 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          {isSeeding ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          Multiplier Standard
                        </button>
                      </div>
                    </div>
                  )}

                {/* CARD 4: Nouveau Cursus / Option sur mesure */}
                {(user.role === UserRole.SUPER_ADMIN ||
                  user.role === UserRole.SCHOOL_ADMIN ||
                  user.role === UserRole.DIRECTOR ||
                  user.is_super_admin) && (
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <Plus size={18} />
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-sm">
                          {school?.school_type === "UNIVERSITY"
                            ? "Nouvelle Discipline / Cursus sur-mesure"
                            : school?.school_type === "PROFESSIONAL"
                            ? "Nouvelle Filière / Spécialité sur-mesure"
                            : `Nouveau Cursus / ${terminology.class} sur-mesure`}
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        {school?.school_type === "UNIVERSITY"
                          ? "Créez une promotion ou un cursus exclusif n'existant pas dans le tronc commun, s'étalant sur le nombre d'années requis pour son achèvement."
                          : school?.school_type === "PROFESSIONAL"
                          ? "Créez une filière ou spécialité exclusive n'existant pas dans le tronc commun, s'étalant sur le nombre d'années requises."
                          : `Créez une promo ou une ${terminology.class.toLowerCase()} exclusive n'existant pas dans la structure standard, s'étalant sur le nombre d'années ou niveaux requis.`}
                      </p>
                    </div>
                    <div className="mt-5">
                      <button
                        onClick={() => {
                          const isUniv = school?.school_type === "UNIVERSITY";
                          const isPro = school?.school_type === "PROFESSIONAL";
                          setCustomDisciplineModal({
                            isOpen: true,
                            name: "",
                            level: isUniv ? "LICENCE" : isPro ? "CERTIFICAT" : "SECONDAIRE",
                            duration: isUniv ? 4 : isPro ? 2 : 1,
                            division: isUniv ? "Universitaire" : isPro ? "Professionnelle" : "Secondaire",
                            isSubmitting: false,
                          });
                        }}
                        className="w-full py-2 px-4 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Plus size={13} />
                        {school?.school_type === "UNIVERSITY"
                          ? "Créer une Discipline"
                          : school?.school_type === "PROFESSIONAL"
                          ? "Créer une Filière"
                          : `Créer une ${terminology.class}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* CARD 5: Importer depuis le Siège Social (Seulement pour les Annexes) */}
                {!isSiegeActive && (
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between md:col-span-2">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <Layers size={18} />
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-sm">
                          {terminology.options} de Référence du Siège Social
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed mb-4">
                        Le Siège Social a configuré différentes {terminology.options.toLowerCase()} et programmes de référence académiques. Vous pouvez choisir d'importer une de ces structures pour votre annexe d'un seul clic. Toutes les promotions associées seront créées et liées automatiquement à leurs {terminology.subjects.toLowerCase()} de cours !
                      </p>
                      
                      {siegeClasses.length === 0 ? (
                        <div className="text-center p-6 bg-slate-50 border border-dashed rounded-xl text-xs font-bold text-slate-500">
                          Aucune discipline de référence n'est disponible au Siège Social actuellement.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                          {(() => {
                            // Extract unique disciplines from siegeClasses
                            const siegeDisciplinesObj: Record<string, SchoolClass[]> = {};
                            siegeClasses.forEach((c) => {
                              const dName = getDisciplineName(c.name);
                              if (!siegeDisciplinesObj[dName]) siegeDisciplinesObj[dName] = [];
                              siegeDisciplinesObj[dName].push(c);
                            });

                            return Object.entries(siegeDisciplinesObj).map(([dName, dLevels]) => {
                              // Check if we already have classes with this group name in the current classes list
                              const alreadyActive = classes.some(
                                (c) => getDisciplineName(c.name) === dName
                              );

                              return (
                                <div key={dName} className="p-3 bg-white border border-gray-150 rounded-lg flex flex-col justify-between gap-2.5 shadow-sm">
                                  <div>
                                    <h5 className="font-bold text-xs text-slate-800 line-clamp-2">{dName}</h5>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mt-0.5">
                                      {dLevels.length} niveau(x) au Siège
                                    </span>
                                  </div>
                                  <div className="flex gap-2 items-center justify-between border-t border-slate-50 pt-1.5 mt-1">
                                    {alreadyActive ? (
                                      <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5 flex items-center gap-1">
                                        <CheckCircle2 size={10} className="shrink-0" /> Activée localement
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 rounded px-1.5 py-0.5">
                                        Disponible
                                      </span>
                                    )}

                                    {!alreadyActive && (
                                      <button
                                        disabled={!!importingDiscipline}
                                        onClick={() => handleImportDiscipline(dName)}
                                        className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                                      >
                                        {importingDiscipline === dName ? (
                                          <>
                                            <Loader2 size={10} className="animate-spin" />
                                            Import...
                                          </>
                                        ) : (
                                          "Importer"
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALE AJOUT DISCIPLINE / CURSUS PERSONNALISÉ */}
      {customDisciplineModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles size={20} className="text-blue-600" />
                {school?.school_type === "UNIVERSITY"
                  ? "Discipline / Cursus Personnalisé"
                  : school?.school_type === "PROFESSIONAL"
                  ? "Filière / Spécialité Personnalisée"
                  : `Structure / ${terminology.class} Sur-Mesure`}
              </h3>
              <button
                onClick={() =>
                  setCustomDisciplineModal((prev) => ({
                    ...prev,
                    isOpen: false,
                  }))
                }
                className="text-gray-400 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleAddCustomDiscipline}
              className="p-6 space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {school?.school_type === "UNIVERSITY"
                    ? "Nom de la Discipline / Filière"
                    : school?.school_type === "PROFESSIONAL"
                    ? "Nom de la Filière / Spécialité"
                    : `Nom du Cursus ou de la ${terminology.class}`}
                </label>
                <input
                  type="text"
                  required
                  value={customDisciplineModal.name}
                  onChange={(e) =>
                    setCustomDisciplineModal((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder={
                    school?.school_type === "UNIVERSITY"
                      ? "Ex: GÉNIE LOGICIEL"
                      : school?.school_type === "PROFESSIONAL"
                      ? "Ex: COUPE-COUTURE"
                      : "Ex: 9ÈME AF, NS1, SECTION BILINGUE..."
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Division Académique
                </label>
                <select
                  value={customDisciplineModal.division}
                  onChange={(e) => {
                    const newDivision = e.target.value;
                    let newLevel = customDisciplineModal.level;
                    if (newDivision === "Universitaire") newLevel = "LICENCE";
                    else if (newDivision === "Professionnelle" || newDivision === "Technique") newLevel = "CERTIFICAT";
                    else if (newDivision === "Secondaire") newLevel = "SECONDAIRE";
                    else if (newDivision === "Fondamental") newLevel = "FONDAMENTAL";
                    else if (newDivision === "Maternelle") newLevel = "MATERNELLE";

                    setCustomDisciplineModal((prev) => ({
                      ...prev,
                      division: newDivision,
                      level: newLevel,
                    }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-sm bg-white"
                >
                  {school?.school_type === "UNIVERSITY" ? (
                    <>
                      <option value="Universitaire">Universitaire</option>
                      <option value="Post-Universitaire">Post-Universitaire</option>
                      <option value="Professionnelle">Professionnelle / Technique</option>
                    </>
                  ) : school?.school_type === "PROFESSIONAL" ? (
                    <>
                      <option value="Professionnelle">Professionnelle</option>
                      <option value="Technique">Technique</option>
                    </>
                  ) : (
                    <>
                      <option value="Secondaire">Secondaire</option>
                      <option value="Fondamental">Fondamental (1er, 2ème, 3ème cycle)</option>
                      <option value="Maternelle">Préscolaire / Maternelle</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Niveau Cible
                  </label>
                  <select
                    value={customDisciplineModal.level}
                    onChange={(e) =>
                      setCustomDisciplineModal((prev) => ({
                        ...prev,
                        level: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-sm bg-white"
                  >
                    {customDisciplineModal.division === "Universitaire" ? (
                      <>
                        <option value="LICENCE">LICENCE</option>
                        <option value="MASTER">MASTER</option>
                        <option value="DOCTORAT">DOCTORAT</option>
                        <option value="DIPLOME">DIPLÔME</option>
                      </>
                    ) : customDisciplineModal.division === "Post-Universitaire" ? (
                      <>
                        <option value="MASTER">MASTER</option>
                        <option value="DOCTORAT">DOCTORAT</option>
                      </>
                    ) : customDisciplineModal.division === "Professionnelle" || customDisciplineModal.division === "Technique" ? (
                      <>
                        <option value="CERTIFICAT">CERTIFICAT</option>
                        <option value="DIPLOME">DIPLÔME</option>
                        <option value="CAP">CAP</option>
                        <option value="BTS">BTS</option>
                      </>
                    ) : customDisciplineModal.division === "Secondaire" ? (
                      <>
                        <option value="SECONDAIRE">SECONDAIRE</option>
                        <option value="NS">NOUVEAU SECONDAIRE (NS)</option>
                        <option value="BACCALAUREAT">BACCALAURÉAT</option>
                      </>
                    ) : customDisciplineModal.division === "Fondamental" ? (
                      <>
                        <option value="FONDAMENTAL">FONDAMENTAL</option>
                        <option value="AF">ANNÉE FONDAMENTALE (AF)</option>
                        <option value="PRIMAIRE">PRIMAIRE</option>
                      </>
                    ) : customDisciplineModal.division === "Maternelle" ? (
                      <>
                        <option value="MATERNELLE">MATERNELLE</option>
                        <option value="PRESCOLAIRE">PRÉSCOLAIRE</option>
                      </>
                    ) : (
                      <>
                        <option value="SECONDAIRE">SECONDAIRE</option>
                        <option value="FONDAMENTAL">FONDAMENTAL</option>
                        <option value="LICENCE">LICENCE</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {customDisciplineModal.duration === 1 ? "Structure" : "Nombre d'années"}
                  </label>
                  <select
                    value={customDisciplineModal.duration}
                    onChange={(e) =>
                      setCustomDisciplineModal((prev) => ({
                        ...prev,
                        duration: Number(e.target.value),
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none text-sm bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                      <option key={num} value={num}>
                        {num}{" "}
                        {num === 1
                          ? `1 ${terminology.class.toLowerCase()} (unique)`
                          : ["LICENCE", "MASTER", "DOCTORAT"].includes(customDisciplineModal.level)
                          ? "ans"
                          : `${terminology.classes.toLowerCase()} / niveaux`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100 mt-2">
                <GraduationCap
                  size={18}
                  className="text-blue-600 mt-0.5 shrink-0"
                />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Action automatique</p>
                  <p className="text-blue-600 leading-relaxed">
                    {customDisciplineModal.duration === 1
                      ? `Cette action créera 1 ${terminology.class.toLowerCase()} unique : "${
                          customDisciplineModal.name ? customDisciplineModal.name.toUpperCase() : "EXEMPLAR"
                        }".`
                      : `Cette action créera ${customDisciplineModal.duration} ${terminology.classes.toLowerCase()} d'un coup (ex: ${
                          customDisciplineModal.name
                            ? `${customDisciplineModal.name.toUpperCase()} I, II...`
                            : "NOM I, II..."
                        }).`}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setCustomDisciplineModal((prev) => ({
                      ...prev,
                      isOpen: false,
                    }))
                  }
                  className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    customDisciplineModal.isSubmitting ||
                    !customDisciplineModal.name.trim()
                  }
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {customDisciplineModal.isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Générer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    {/* MODALE D'ACTION DISCIPLINE (RENAME / DELETE) */}
      {disciplineActionModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {disciplineActionModal.type === "rename" ? (
                  <>
                    <Edit2 size={18} className="text-blue-600" />
                    Modifier la filière
                  </>
                ) : disciplineActionModal.type === "move" ? (
                  <>
                    <Sparkles size={18} className="text-amber-600" />
                    Déplacer la discipline
                  </>
                ) : (
                  <>
                    <Trash2 size={18} className="text-red-700" />
                    Supprimer la filière
                  </>
                )}
              </h3>
              <button
                onClick={() =>
                  setDisciplineActionModal((prev) => ({
                    ...prev,
                    isOpen: false,
                  }))
                }
                className="text-gray-400 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {disciplineActionModal.error && (
                <div className="p-3 bg-red-50 border border-red-150 text-red-700 rounded-lg text-xs leading-relaxed">
                  {disciplineActionModal.error}
                </div>
              )}
              
              {disciplineActionModal.type === "rename" ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Cette action va renommer tous les niveaux et promotions associés à la filière <strong className="text-gray-950 font-bold">"{disciplineActionModal.disciplineName}"</strong>.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Nouveau nom de la discipline
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-200 focus:border-blue-550 focus:ring focus:ring-blue-100/50 rounded-lg text-sm bg-gray-50/50"
                      placeholder="Ex: Administration & Gestion Financière"
                      value={disciplineActionModal.newName}
                      onChange={(e) =>
                        setDisciplineActionModal((prev) => ({
                          ...prev,
                          newName: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : disciplineActionModal.type === "move" ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Déplacez la discipline <strong className="text-gray-950 font-bold">"{disciplineActionModal.disciplineName}"</strong> vers une autre division académique. Les matières et configurations associées seront préservées.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Division cible
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-550 rounded-lg text-sm bg-white outline-none"
                      value={disciplineActionModal.targetDivision}
                      onChange={(e) =>
                        setDisciplineActionModal((prev) => ({
                          ...prev,
                          targetDivision: e.target.value as any,
                        }))
                      }
                    >
                      {school?.school_type === "UNIVERSITY" ? (
                        <>
                          <option value="Universitaire">Universitaire</option>
                          <option value="Post-Universitaire">Post-Universitaire</option>
                          <option value="Professionnelle">Professionnelle / Technique</option>
                        </>
                      ) : school?.school_type === "PROFESSIONAL" ? (
                        <>
                          <option value="Professionnelle">Professionnelle</option>
                          <option value="Technique">Technique</option>
                        </>
                      ) : (
                        <>
                          <option value="Secondaire">Secondaire</option>
                          <option value="Fondamental">Fondamental</option>
                          <option value="Maternelle">Préscolaire / Maternelle</option>
                        </>
                      )}
                    </select>
                  </div>
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2.5 leading-relaxed">
                    Note : Les niveaux Licence/Master ne s'affichant pas en Professionnelle, ils seront automatiquement convertis en niveau "DIPLÔME" s'ils sont déplacés. De même, un niveau Certificat déplacé vers Universitaire sera converti en niveau "DIPLÔME".
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-2.5">
                    <ShieldAlert size={20} className="text-red-650 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1.5 leading-relaxed">
                      <p className="font-extrabold uppercase tracking-wide text-red-950">Avertissement de suppression en cascade</p>
                      <p>
                        Vous êtes sur le point de supprimer entièrement la filière <strong className="font-extrabold text-gray-955">"{disciplineActionModal.disciplineName}"</strong>.
                      </p>
                      <p className="font-bold">
                        Tous les niveaux académiques (ex: I, II, III), leurs frais d'admission, les attributions de matières, et les inscriptions des étudiants associés seront effacés de manière irréversible !
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Cette action est définitive. Confirmez-vous la suppression ?
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setDisciplineActionModal((prev) => ({
                    ...prev,
                    isOpen: false,
                  }))
                }
                className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                disabled={disciplineActionModal.isSubmitting}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExecuteDisciplineAction}
                disabled={disciplineActionModal.isSubmitting || (disciplineActionModal.type === "rename" && !disciplineActionModal.newName.trim())}
                className={`flex-1 py-2 text-white rounded-lg font-medium text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${
                  disciplineActionModal.type === "rename"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : disciplineActionModal.type === "move"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {disciplineActionModal.isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  disciplineActionModal.type === "rename" ? "Renommer" : disciplineActionModal.type === "move" ? "Déplacer" : "Supprimer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION PERSONNALISÉE */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {confirmModal.title}
                </h3>
                <div className="mt-2 space-y-2">
                  <p className="text-gray-500 text-sm">
                    {confirmModal.message}
                  </p>
                  <span className="text-gray-900 font-semibold text-base block">
                    {confirmModal.name}
                  </span>
                </div>

                {confirmModal.error && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm text-left">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{confirmModal.error}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() =>
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handlePerformDelete}
                  disabled={isDeleting !== null || isSeeding || isMigrating}
                  className="py-2.5 bg-rose-600 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-rose-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {isDeleting !== null || isSeeding || isMigrating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE D'INJECTION DE DISCIPLINE AUX AUTRES ANNEXES */}
      {injectModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Send size={18} className="text-emerald-600" />
                Diffuser la Discipline vers les Annexes
              </h3>
              <button
                type="button"
                onClick={() => setInjectModal(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-extrabold tracking-wider">Discipline de Référence du Siège</p>
                <h4 className="text-base font-extrabold text-gray-950 mt-1">{injectModal.disciplineName}</h4>
                <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                  Cette action va créer tous les niveaux d'enseignement de la filière <strong className="text-gray-900 font-bold">"{injectModal.disciplineName}"</strong> déjà définis au Siège Social, et les injecter avec leurs grilles de cours (matières et coefficients) dans les annexes choisies.
                </p>
              </div>

              {injectModal.success && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-850 text-xs font-semibold space-y-1">
                  <div className="flex gap-2 items-start font-extrabold">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>Diffusion réussie !</span>
                  </div>
                  <p className="pl-6 text-emerald-750 leading-snug">{injectModal.success}</p>
                </div>
              )}

              {injectModal.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{injectModal.error}</span>
                </div>
              )}

              {/* Annexes list */}
              {!injectModal.success && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700">Sélectionner les annexes destinataires :</span>
                    {(() => {
                      const targetAnnexes = (campuses || []).filter(
                        (c) => c.id !== siegeCampusId && c.id !== currentCampusId
                      );
                      const allSelected = targetAnnexes.length > 0 && targetAnnexes.every(c => injectModal.selectedCampusIds.includes(c.id));
                      return targetAnnexes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setInjectModal(prev => ({ ...prev, selectedCampusIds: [] }));
                            } else {
                              setInjectModal(prev => ({ ...prev, selectedCampusIds: targetAnnexes.map(c => c.id) }));
                            }
                          }}
                          className="text-[10px] uppercase font-extrabold text-blue-600 hover:underline cursor-pointer"
                        >
                          {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                        </button>
                      );
                    })()}
                  </div>

                  <div className="border border-gray-150 rounded-xl p-3 bg-slate-50/50 max-h-48 overflow-y-auto space-y-2">
                    {(() => {
                      const targetAnnexes = (campuses || []).filter(
                        (c) => c.id !== siegeCampusId && c.id !== currentCampusId
                      );

                      if (targetAnnexes.length === 0) {
                        return (
                          <p className="text-xs font-bold text-gray-500 text-center py-4">
                            Aucune autre annexe n'a été répertoriée pour cet établissement.
                          </p>
                        );
                      }

                      return targetAnnexes.map((campusItem) => {
                        const isChecked = injectModal.selectedCampusIds.includes(campusItem.id);
                        return (
                          <label
                            key={campusItem.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer bg-white ${
                              isChecked
                                ? "border-blue-200 bg-blue-50/20 text-blue-900 font-semibold"
                                : "border-gray-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setInjectModal((prev) => {
                                  const alreadySelected = prev.selectedCampusIds.includes(campusItem.id);
                                  return {
                                    ...prev,
                                    selectedCampusIds: alreadySelected
                                      ? prev.selectedCampusIds.filter((id) => id !== campusItem.id)
                                      : [...prev.selectedCampusIds, campusItem.id],
                                  };
                                });
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <div className="flex-1">
                              <span className="text-xs font-bold">{campusItem.name}</span>
                              {campusItem.address && (
                                <span className="text-[10px] text-gray-400 block -mt-0.5 font-normal">
                                  {campusItem.address}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setInjectModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold text-xs hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
              
              {!injectModal.success && (
                <button
                  type="button"
                  disabled={injectModal.isSubmitting || injectModal.selectedCampusIds.length === 0}
                  onClick={handleExecuteInjection}
                  className="px-4 py-2 bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {injectModal.isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Diffusion en cours...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Diffuser la Discipline ({injectModal.selectedCampusIds.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Coefficient Modal */}
      {editCoefModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Bookmark size={18} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Modifier le Coefficient
                </h3>
              </div>
              <button
                onClick={() => setEditCoefModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Matière & Classe concernées
              </p>
              <p className="text-sm font-bold text-slate-900">
                {editCoefModal.subjectName}{" "}
                <span className="text-blue-600 font-normal">({editCoefModal.className})</span>
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Nouveau Coefficient / Barème (ex: 100, 200, 300)
              </label>
              <input
                type="number"
                min="0.5"
                max="500"
                step="0.5"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-extrabold text-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center bg-white"
                value={editCoefModal.coefficient}
                onChange={(e) =>
                  setEditCoefModal((prev) => ({
                    ...prev,
                    coefficient: parseFloat(e.target.value) || 1,
                  }))
                }
              />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Raccourcis rapides :</p>
                <div className="flex flex-wrap gap-1.5">
                  {[100, 200, 300, 10, 20, 1, 2, 3, 4, 5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setEditCoefModal((prev) => ({
                          ...prev,
                          coefficient: preset,
                        }))
                      }
                      className={`px-2.5 py-1 text-xs font-black rounded-lg border transition-all cursor-pointer ${
                        editCoefModal.coefficient === preset
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium pt-1">
                Note : Modifiable à volonté par l'administrateur. Reste strictly propre à votre établissement.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditCoefModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveInlineCoef}
                disabled={editCoefModal.isSaving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {editCoefModal.isSaving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Enregistrer Coefficient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
