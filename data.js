// Mock Database for Crime Investigation Board (CIB) - DEPRECATED / API BACKEND SYNC ACTIVE
// Keep file structure for frontend namespace references if needed, but values are loaded dynamically from live API database.
const CIB_DB = {
  currentUser: {
    name: "Adil Khan",
    id: "SA-001",
    rank: "Supervisory Special Agent",
    department: "Major Crimes Division",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120"
  },
  officers: [],
  cases: [],
  evidence: [],
  forensics: [],
  tasks: [],
  recentActivities: []
};

window.CIB_DB = CIB_DB;
