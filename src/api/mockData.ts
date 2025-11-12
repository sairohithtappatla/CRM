export interface Lead {
  id: number;
  parentName: string;
  studentName: string;
  class: string;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED';
  score: number;
  lastMsg: string;
  lastContact: string;
  lang: string;
  phone: string;
  email: string;
  source: string;
  messages: Message[];
  payments: Payment[];
}

export interface Message {
  id: number;
  sender: 'parent' | 'admin';
  text: string;
  timestamp: string;
}

export interface Payment {
  id: number;
  date: string;
  type: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
}

export const mockLeads: Lead[] = [
  {
    id: 1,
    parentName: "Ramesh Kumar",
    studentName: "Arjun",
    class: "10",
    status: "HOT",
    score: 84,
    lastMsg: "Is demo class available this Saturday?",
    lastContact: "2h ago",
    lang: "English",
    phone: "+91 98765 43210",
    email: "ramesh.k@email.com",
    source: "WhatsApp",
    messages: [
      { id: 1, sender: "parent", text: "Hello, I'm interested in JEE coaching", timestamp: "Yesterday 3:45 PM" },
      { id: 2, sender: "admin", text: "Welcome! We'd love to help. What class is your child in?", timestamp: "Yesterday 3:50 PM" },
      { id: 3, sender: "parent", text: "He's in 10th standard", timestamp: "Yesterday 4:00 PM" },
      { id: 4, sender: "admin", text: "Perfect! We have specialized JEE foundation batches for 10th. Would you like a demo?", timestamp: "Today 10:30 AM" },
      { id: 5, sender: "parent", text: "Is demo class available this Saturday?", timestamp: "2h ago" },
    ],
    payments: [
      { id: 1, date: "2024-01-15", type: "Registration", amount: 500, status: "Paid" },
    ],
  },
  {
    id: 2,
    parentName: "Lakshmi Devi",
    studentName: "Priya",
    class: "11",
    status: "WARM",
    score: 68,
    lastMsg: "What are the batch timings?",
    lastContact: "5h ago",
    lang: "English",
    phone: "+91 98123 45678",
    email: "lakshmi.devi@email.com",
    source: "Facebook",
    messages: [
      { id: 1, sender: "parent", text: "I saw your ad on Facebook", timestamp: "2 days ago" },
      { id: 2, sender: "admin", text: "Thank you for reaching out! How can we help?", timestamp: "2 days ago" },
      { id: 3, sender: "parent", text: "What are the batch timings?", timestamp: "5h ago" },
    ],
    payments: [],
  },
    {
    id: 3,
    parentName: "Venkatesh Reddy",
    studentName: "Karthik",
    class: "12",
    status: "COLD",
    score: 35,
    lastMsg: "Will get back to you",
    lastContact: "3d ago",
    lang: "Telugu",
    phone: "+91 99988 77766",
    email: "venkat.reddy@email.com",
    source: "Google",
    messages: [
      { id: 1, sender: "parent", text: "Found your institute on Google", timestamp: "1 week ago" },
      { id: 2, sender: "admin", text: "Great! Are you looking for JEE or NEET coaching?", timestamp: "1 week ago" },
      { id: 3, sender: "parent", text: "Will get back to you", timestamp: "3d ago" },
    ],
    payments: [],
  },
  {
    id: 4,
    parentName: "Suresh Babu",
    studentName: "Aditya",
    class: "9",
    status: "COLD",
    score: 35,
    lastMsg: "Will get back to you",
    lastContact: "3d ago",
    lang: "Telugu",
    phone: "+91 99988 77766",
    email: "venkat.reddy@email.com",
    source: "Google",
    messages: [
      { id: 1, sender: "parent", text: "Found your institute on Google", timestamp: "1 week ago" },
      { id: 2, sender: "admin", text: "Great! Are you looking for JEE or NEET coaching?", timestamp: "1 week ago" },
      { id: 3, sender: "parent", text: "Will get back to you", timestamp: "3d ago" },
    ],
    payments: [],
  },
  {
    id: 7,
    parentName: "Suresh Babu",
    studentName: "Aditya",
    class: "9",
    status: "COLD",
    score: 35,
    lastMsg: "Will get back to you",
    lastContact: "3d ago",
    lang: "Telugu",
    phone: "+91 99988 77766",
    email: "venkat.reddy@email.com",
    source: "Google",
    messages: [
      { id: 1, sender: "parent", text: "Found your institute on Google", timestamp: "1 week ago" },
      { id: 2, sender: "admin", text: "Great! Are you looking for JEE or NEET coaching?", timestamp: "1 week ago" },
      { id: 3, sender: "parent", text: "Will get back to you", timestamp: "3d ago" },
    ],
    payments: [],
  },
  {
    id: 5,
    parentName: "Suresh Babu",
    studentName: "Aditya",
    class: "9",
    status: "FOLLOW-UP",
    score: 72,
    lastMsg: "Please call tomorrow morning",
    lastContact: "1d ago",
    lang: "English",
    phone: "+91 98111 22334",
    email: "suresh.b@email.com",
    source: "Referral",
    messages: [
      { id: 1, sender: "parent", text: "My friend recommended your classes", timestamp: "3 days ago" },
      { id: 2, sender: "admin", text: "Thank you for the trust! We'd love to help your child excel.", timestamp: "3 days ago" },
      { id: 3, sender: "parent", text: "Please call tomorrow morning", timestamp: "1d ago" },
    ],
    payments: [],
  },
  {
    id: 5,
    parentName: "Madhavi Sharma",
    studentName: "Sneha",
    class: "11",
    status: "ADMITTED",
    score: 95,
    lastMsg: "Thank you! Excited to start",
    lastContact: "6h ago",
    lang: "English",
    phone: "+91 98765 11223",
    email: "madhavi.s@email.com",
    source: "WhatsApp",
    messages: [
      { id: 1, sender: "parent", text: "Interested in NEET batch", timestamp: "2 weeks ago" },
      { id: 2, sender: "admin", text: "We have excellent NEET programs. Would you like to schedule a visit?", timestamp: "2 weeks ago" },
      { id: 3, sender: "parent", text: "Yes, visited yesterday. Ready to enroll!", timestamp: "1 week ago" },
      { id: 4, sender: "admin", text: "Wonderful! I've sent the enrollment form.", timestamp: "1 week ago" },
      { id: 5, sender: "parent", text: "Thank you! Excited to start", timestamp: "6h ago" },
      
    ],
    payments: [
      { id: 1, date: "2024-01-20", type: "Admission Fee", amount: 5000, status: "Paid" },
      { id: 2, date: "2024-01-20", type: "First Term", amount: 25000, status: "Paid" },
    ],
  },
  {
    id: 6,
    parentName: "Prakash Rao",
    studentName: "Rohit",
    class: "10",
    status: "HOT",
    score: 88,
    lastMsg: "Can we visit this weekend?",
    lastContact: "1h ago",
    lang: "English",
    phone: "+91 98444 55666",
    email: "prakash.r@email.com",
    source: "WhatsApp",
    messages: [
      { id: 1, sender: "parent", text: "Looking for IIT foundation course", timestamp: "Today 9:00 AM" },
      { id: 2, sender: "admin", text: "Perfect timing! We have a new batch starting next week.", timestamp: "Today 9:15 AM" },
      { id: 3, sender: "parent", text: "Can we visit this weekend?", timestamp: "1h ago" },
    ],
    payments: [],
  },
  {
    id: 7,
    parentName: "Anjali Nair",
    studentName: "Krish",
    class: "12",
    status: "WARM",
    score: 61,
    lastMsg: "Need to discuss fees",
    lastContact: "8h ago",
    lang: "English",
    phone: "+91 97333 22111",
    email: "anjali.n@email.com",
    source: "Instagram",
    messages: [
      { id: 1, sender: "parent", text: "Saw your success stories on Instagram", timestamp: "Yesterday" },
      { id: 2, sender: "admin", text: "Thank you! We're proud of our students. How can we help?", timestamp: "Yesterday" },
      { id: 3, sender: "parent", text: "Need to discuss fees", timestamp: "8h ago" },
    ],
    payments: [],
  },
];

export const analyticsData = {
  totalLeads: 45,
  hotLeads: 12,
  demosScheduled: 8,
  admissions: 15,
  conversionRate: 33.3,
  leadsOverTime: [
    { month: "Aug", leads: 28 },
    { month: "Sep", leads: 35 },
    { month: "Oct", leads: 42 },
    { month: "Nov", leads: 38 },
    { month: "Dec", leads: 45 },
    { month: "Jan", leads: 52 },
  ],
  leadsByStatus: [
    { name: "HOT", count: 12 },
    { name: "WARM", count: 15 },
    { name: "COLD", count: 8 },
    { name: "FOLLOW-UP", count: 10 },
  ],
  leadSources: [
    { name: "WhatsApp", value: 45, color: "#25D366" },
    { name: "Facebook", value: 25, color: "#1877F2" },
    { name: "Google", value: 15, color: "#4285F4" },
    { name: "Referral", value: 10, color: "#FF7B00" },
    { name: "Walk-in", value: 5, color: "#2C2C2C" },
  ],
};
