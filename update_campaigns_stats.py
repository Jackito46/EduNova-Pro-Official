import re

with open('components/AdHocCampaignsView.tsx', 'r') as f:
    content = f.read()

# 1. Add calculations for the financial summary
calc_target = """  const visibleAssignedCount = filteredStudents.filter(s => assignedIds.has(s.id)).length;
  const visibleUnassignedCount = filteredStudents.length - visibleAssignedCount;"""

calc_replacement = """  const visibleAssignedCount = filteredStudents.filter(s => assignedIds.has(s.id)).length;
  const visibleUnassignedCount = filteredStudents.length - visibleAssignedCount;

  // Financial calculations
  const totalExpected = Array.from(assignedIds).length * campaign.amount;
  const totalCollected = Array.from(assignedIds).reduce((sum, id) => sum + (studentPayments[id] || 0), 0);
  const totalRemaining = totalExpected - totalCollected;
  const recoveryRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : "0.0";"""

content = content.replace(calc_target, calc_replacement)

# 2. Add the Financial Summary Dashboard UI
ui_target = """      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        {/* Advanced Filters Block */}"""

ui_replacement = """      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        {/* Financial Summary Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1">Total Attendu</span>
            <span className="text-xl font-black text-slate-800 font-mono">{totalExpected.toLocaleString()} {campaign.currency}</span>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 mb-1">Total Encaissé</span>
            <span className="text-xl font-black text-emerald-700 font-mono">{totalCollected.toLocaleString()} {campaign.currency}</span>
          </div>
          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-rose-600 mb-1">Reste à Recouvrer</span>
            <span className="text-xl font-black text-rose-700 font-mono">{totalRemaining.toLocaleString()} {campaign.currency}</span>
          </div>
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-center relative overflow-hidden">
            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 mb-1">Taux de Recouvrement</span>
            <span className="text-2xl font-black text-indigo-700 font-mono">{recoveryRate}%</span>
            <div className="absolute bottom-0 left-0 h-1.5 bg-indigo-200 w-full opacity-50">
              <div className="h-full bg-indigo-500 rounded-r-full transition-all duration-1000" style={{ width: `${recoveryRate}%` }} />
            </div>
          </div>
        </div>

        {/* Advanced Filters Block */}"""

content = content.replace(ui_target, ui_replacement)

# 3. Add Print Button to Mass Actions
btn_target = """              <button 
                onClick={unassignAllVisible} 
                disabled={currentCampaignStatus === 'COMPLETED'}
                className="bg-rose-50 text-rose-600 font-black text-[11px] px-4 py-2.5 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-50"
                title={`Retirer tous les ${terminology.students?.toLowerCase() || 'élèves'} affichés ci-dessous qui n'ont pas encore payé`}
              >
                <X size={14} className="shrink-0" /> Tout Retirer
              </button>
            </div>
          </div>"""

btn_replacement = """              <button 
                onClick={unassignAllVisible} 
                disabled={currentCampaignStatus === 'COMPLETED'}
                className="bg-rose-50 text-rose-600 font-black text-[11px] px-4 py-2.5 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-50"
                title={`Retirer tous les ${terminology.students?.toLowerCase() || 'élèves'} affichés ci-dessous qui n'ont pas encore payé`}
              >
                <X size={14} className="shrink-0" /> Tout Retirer
              </button>
              
              <button
                onClick={() => window.print()}
                className="bg-slate-800 text-white font-black text-[11px] px-4 py-2.5 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                title="Imprimer le rapport de la sélection actuelle"
              >
                <Printer size={14} className="shrink-0" /> Imprimer Rapport
              </button>
            </div>
          </div>"""

content = content.replace(btn_target, btn_replacement)

# 4. Check for Printer import and add if missing
if 'Printer' not in content:
    content = content.replace('X,', 'X,\n  Printer,')

with open('components/AdHocCampaignsView.tsx', 'w') as f:
    f.write(content)

print("UI UPDATED")
