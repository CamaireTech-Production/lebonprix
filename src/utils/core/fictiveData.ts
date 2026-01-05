/**
 * Données fictives pour le dashboard employé
 * Ces données sont génériques et identiques pour tous les employés
 */

export const FICTIVE_DATA = {
  companyName: "Entreprise Exemple",
  logo: "/placeholder-logo.png",
  description: "Ceci est un exemple de dashboard avec des données fictives",
  
  // Statistiques principales
  stats: {
    sales: 1234,
    products: 56,
    customers: 78,
    revenue: 45000
  },

  // Données de ventes fictives
  recentSales: [
    {
      id: "sale_001",
      customer: "Jean Dupont",
      product: "Produit A",
      amount: 150.00,
      date: "2024-01-15",
      status: "completed"
    },
    {
      id: "sale_002", 
      customer: "Marie Martin",
      product: "Produit B",
      amount: 89.50,
      date: "2024-01-14",
      status: "completed"
    },
    {
      id: "sale_003",
      customer: "Pierre Durand",
      product: "Produit C",
      amount: 234.75,
      date: "2024-01-13",
      status: "pending"
    }
  ],

  // Produits fictifs
  products: [
    {
      id: "prod_001",
      name: "Produit A",
      price: 150.00,
      stock: 25,
      category: "Électronique"
    },
    {
      id: "prod_002",
      name: "Produit B", 
      price: 89.50,
      stock: 12,
      category: "Vêtements"
    },
    {
      id: "prod_003",
      name: "Produit C",
      price: 234.75,
      stock: 8,
      category: "Maison"
    }
  ],

  // Clients fictifs
  customers: [
    {
      id: "cust_001",
      name: "Jean Dupont",
      email: "jean.dupont@email.com",
      phone: "01 23 45 67 89",
      totalOrders: 5,
      totalSpent: 750.00
    },
    {
      id: "cust_002",
      name: "Marie Martin",
      email: "marie.martin@email.com", 
      phone: "01 98 76 54 32",
      totalOrders: 3,
      totalSpent: 268.50
    },
    {
      id: "cust_003",
      name: "Pierre Durand",
      email: "pierre.durand@email.com",
      phone: "01 11 22 33 44",
      totalOrders: 2,
      totalSpent: 469.50
    }
  ],

  // Dépenses fictives
  expenses: [
    {
      id: "exp_001",
      description: "Fournitures de bureau",
      amount: 150.00,
      category: "Administration",
      date: "2024-01-10"
    },
    {
      id: "exp_002",
      description: "Marketing digital",
      amount: 300.00,
      category: "Marketing",
      date: "2024-01-08"
    },
    {
      id: "exp_003",
      description: "Équipement informatique",
      amount: 500.00,
      category: "Équipement",
      date: "2024-01-05"
    }
  ],

  // Objectifs fictifs
  objectives: [
    {
      id: "obj_001",
      title: "Ventes mensuelles",
      target: 10000,
      current: 7500,
      deadline: "2024-01-31",
      status: "in_progress"
    },
    {
      id: "obj_002",
      title: "Nouveaux clients",
      target: 50,
      current: 32,
      deadline: "2024-02-28",
      status: "in_progress"
    }
  ],

  // Graphiques de données fictives
  chartData: {
    salesOverTime: [
      { month: "Jan", sales: 12000 },
      { month: "Fév", sales: 15000 },
      { month: "Mar", sales: 18000 },
      { month: "Avr", sales: 16000 },
      { month: "Mai", sales: 20000 },
      { month: "Juin", sales: 22000 }
    ],
    revenueByCategory: [
      { category: "Électronique", revenue: 15000 },
      { category: "Vêtements", revenue: 12000 },
      { category: "Maison", revenue: 8000 },
      { category: "Autres", revenue: 5000 }
    ]
  },

  // Messages d'information
  infoBanner: {
    title: "📊 Mode Employé - Données Fictives",
    message: "Ce dashboard contient des données fictives à titre d'exemple. Les vraies données apparaîtront lorsque vous serez employé d'une entreprise.",
    dismissible: true
  }
};

export default FICTIVE_DATA;
