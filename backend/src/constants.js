export const DEPARTMENTS = [
  'Electrical',
  'Plumbing & Water',
  'Civil & Maintenance',
  'Hostel Administration',
  'Mess & Food',
  'IT & Network',
  'Housekeeping & Sanitation',
  'Security',
  'Transport',
  // new: needed for the Academic and CSE categories (run `npm run setup` again to seed their heads)
  'Academic Affairs',
  'CSE Department'
];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const PRIORITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
export const ACTIVE_STATUSES = ['assigned', 'in_progress', 'reopened'];

// Category -> sub-category tree shown in the "Report an issue" dropdowns.
// `department` decides who gets the ticket; null = let the AI triage pick the department.
export const CATEGORIES = [
  {
    label: 'Electrical',
    subs: [
      { label: 'Light / tubelight not working', department: 'Electrical' },
      { label: 'Fan not working', department: 'Electrical' },
      { label: 'Switch / socket fault', department: 'Electrical' },
      { label: 'Wiring / short circuit / sparks', department: 'Electrical' },
      { label: 'Power outage', department: 'Electrical' },
      { label: 'Geyser / water heater', department: 'Electrical' },
      { label: 'Street / campus lighting', department: 'Electrical' },
      { label: 'Other electrical issue', department: 'Electrical' }
    ]
  },
  {
    label: 'Mess & Food',
    subs: [
      { label: 'Food quality / taste', department: 'Mess & Food' },
      { label: 'Stale or contaminated food', department: 'Mess & Food' },
      { label: 'Hygiene in kitchen / dining hall', department: 'Mess & Food' },
      { label: 'Menu / quantity', department: 'Mess & Food' },
      { label: 'Drinking water in mess', department: 'Mess & Food' },
      { label: 'Mess billing / charges', department: 'Mess & Food' },
      { label: 'Mess staff behaviour', department: 'Mess & Food' },
      { label: 'Other mess issue', department: 'Mess & Food' }
    ]
  },
  {
    label: 'Academic',
    subs: [
      { label: 'Classroom infrastructure (benches, board, projector)', department: 'Civil & Maintenance' },
      { label: 'Timetable / scheduling', department: 'Academic Affairs' },
      { label: 'Exam / evaluation / results', department: 'Academic Affairs' },
      { label: 'Faculty / teaching concern', department: 'Academic Affairs' },
      { label: 'Library facilities', department: 'Academic Affairs' },
      { label: 'Certificates / office paperwork', department: 'Academic Affairs' },
      { label: 'Scholarship / fee issue', department: 'Academic Affairs' },
      { label: 'Other academic issue', department: 'Academic Affairs' }
    ]
  },
  {
    label: 'CSE Department',
    subs: [
      { label: 'Lab computer / hardware fault', department: 'CSE Department' },
      { label: 'Software / licence not available', department: 'CSE Department' },
      { label: 'Department Wi-Fi / LAN', department: 'IT & Network' },
      { label: 'Projector / smart board', department: 'CSE Department' },
      { label: 'Classroom / seminar hall', department: 'CSE Department' },
      { label: 'Server / portal / account access', department: 'IT & Network' },
      { label: 'Course / lab schedule', department: 'CSE Department' },
      { label: 'Other CSE issue', department: 'CSE Department' }
    ]
  },
  {
    label: 'Hostel',
    subs: [
      { label: 'Room allotment / change', department: 'Hostel Administration' },
      { label: 'Furniture (bed, table, cupboard)', department: 'Civil & Maintenance' },
      { label: 'Warden / hostel office', department: 'Hostel Administration' },
      { label: 'Visitor / entry rules', department: 'Hostel Administration' },
      { label: 'Common room / recreation', department: 'Hostel Administration' },
      { label: 'Other hostel issue', department: 'Hostel Administration' }
    ]
  },
  {
    label: 'Water & Plumbing',
    subs: [
      { label: 'Tap / pipe leakage', department: 'Plumbing & Water' },
      { label: 'No water supply', department: 'Plumbing & Water' },
      { label: 'Drinking water / water cooler', department: 'Plumbing & Water' },
      { label: 'Drain / flush blockage', department: 'Plumbing & Water' },
      { label: 'Other plumbing issue', department: 'Plumbing & Water' }
    ]
  },
  {
    label: 'Cleanliness & Sanitation',
    subs: [
      { label: 'Bathroom / toilet cleaning', department: 'Housekeeping & Sanitation' },
      { label: 'Garbage / dustbin overflow', department: 'Housekeeping & Sanitation' },
      { label: 'Corridor / common area cleaning', department: 'Housekeeping & Sanitation' },
      { label: 'Mosquitoes / pests', department: 'Housekeeping & Sanitation' },
      { label: 'Bad smell / drainage odour', department: 'Housekeeping & Sanitation' },
      { label: 'Other cleanliness issue', department: 'Housekeeping & Sanitation' }
    ]
  },
  {
    label: 'Internet & Network',
    subs: [
      { label: 'Wi-Fi not working / slow', department: 'IT & Network' },
      { label: 'Hostel LAN / router', department: 'IT & Network' },
      { label: 'Student portal / login', department: 'IT & Network' },
      { label: 'Other network issue', department: 'IT & Network' }
    ]
  },
  {
    label: 'Civil & Infrastructure',
    subs: [
      { label: 'Wall / ceiling crack or seepage', department: 'Civil & Maintenance' },
      { label: 'Door / window damage', department: 'Civil & Maintenance' },
      { label: 'Road / pothole / pathway', department: 'Civil & Maintenance' },
      { label: 'Roof leakage', department: 'Civil & Maintenance' },
      { label: 'Other infrastructure issue', department: 'Civil & Maintenance' }
    ]
  },
  {
    label: 'Security & Safety',
    subs: [
      { label: 'Theft / lost property', department: 'Security' },
      { label: 'Stray animals', department: 'Security' },
      { label: 'Harassment / ragging', department: 'Security' },
      { label: 'CCTV / gate / lighting safety', department: 'Security' },
      { label: 'Other safety concern', department: 'Security' }
    ]
  },
  {
    label: 'Transport',
    subs: [
      { label: 'Bus / shuttle timing', department: 'Transport' },
      { label: 'Vehicle condition', department: 'Transport' },
      { label: 'Other transport issue', department: 'Transport' }
    ]
  },
  {
    label: 'Other',
    subs: [{ label: 'Something else', department: null }]
  }
];

export function findSubCategory(mainLabel, subLabel) {
  const main = CATEGORIES.find((c) => c.label === mainLabel);
  const sub = main?.subs.find((s) => s.label === subLabel);
  return main && sub ? { main, sub } : null;
}
