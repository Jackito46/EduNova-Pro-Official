export const geminiService = {
  /**
   * Generates a pedagogical comment based on student performance.
   */
  async generateStudentReport(studentName: string, grades: any[]) {
    try {
      const response = await fetch('/api/gemini/generate-student-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, grades }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.text || "Analyse pédagogique haute précision indisponible.";
    } catch (error: any) {
      console.error("Gemini Pro Error:", error?.message || error);
      return "Analyse pédagogique haute précision indisponible.";
    }
  },

  /**
   * Analyzes financial trends for the school administrator.
   */
  async analyzeFinancialHealth(stats: any) {
    try {
      const response = await fetch('/api/gemini/analyze-financial-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.text || "Audit financier stratégique indisponible.";
    } catch (error: any) {
      console.error("Gemini Finance Error:", error?.message || error);
      return "Audit financier stratégique indisponible.";
    }
  },

  /**
   * Generates a generic text response based on a prompt.
   */
  async generateText(prompt: string) {
    try {
      const response = await fetch('/api/gemini/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.text;
    } catch (error: any) {
      console.error("Gemini Text Generation Error:", error?.message || error);
      return null;
    }
  }
};
