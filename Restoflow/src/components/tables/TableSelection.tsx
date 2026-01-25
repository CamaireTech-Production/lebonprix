import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Table, ChefHat, LogOut } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { Restaurant, Table as TableType } from '../../types';

const TableSelection: React.FC = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<TableType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Exclude /public-menu/ routes from table-selection redirect logic
    if (location.pathname.startsWith('/public-menu/')) {
      setLoading(false);
      return;
    }
    // Check if a table is already selected in localStorage
    const storedTable = localStorage.getItem('selectedTable');
    const storedRestaurant = localStorage.getItem('selectedRestaurant');
    if (storedTable && storedRestaurant) {
      try {
        const restaurantData = JSON.parse(storedRestaurant);
        setSelectedRestaurant(restaurantData);
        setSelectedTable(parseInt(storedTable));
        // Navigate to the menu page
        navigate(`/menu/${restaurantData.id}`);
      } catch (error) {
        // If there's an error parsing the stored data, clear it
        localStorage.removeItem('selectedTable');
        localStorage.removeItem('selectedRestaurant');
      }
    }
    const fetchRestaurants = async () => {
      try {
        const restaurantsQuery = query(
          collection(db, 'restaurants'),
          orderBy('name')
        );
        const restaurantsSnapshot = await getDocs(restaurantsQuery);
        const restaurantsData = restaurantsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Restaurant[];
        setRestaurants(restaurantsData);
      } catch (error) {
        console.error('Error fetching restaurants:', error);
        toast.error('Failed to load restaurants');
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, [navigate, location]);

  useEffect(() => {
    if (selectedRestaurant) {
      setLoading(true);
      
      const fetchTables = async () => {
        try {
          const tablesQuery = query(
            collection(db, 'tables'),
            where('restaurantId', '==', selectedRestaurant.id),
            orderBy('number')
          );
          const tablesSnapshot = await getDocs(tablesQuery);
          const tablesData = tablesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as TableType[];
          setTables(tablesData);
        } catch (error) {
          console.error('Error fetching tables:', error);
          toast.error('Failed to load tables');
        } finally {
          setLoading(false);
        }
      };

      fetchTables();
    }
  }, [selectedRestaurant]);

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setSelectedTable(null);
  };

  const handleTableSelect = (table: TableType) => {
    setSelectedTable(table.number);
    
    // Store the selected table and restaurant in localStorage
    localStorage.setItem('selectedTable', table.number.toString());
    localStorage.setItem('selectedRestaurant', JSON.stringify(selectedRestaurant));
    
    // Navigate to the menu page
    navigate(`/menu/${selectedRestaurant?.id}`);
  };

  const handleReset = () => {
    localStorage.removeItem('selectedTable');
    localStorage.removeItem('selectedRestaurant');
    setSelectedRestaurant(null);
    setSelectedTable(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <LoadingSpinner size={60} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4">
      <header className="text-center mb-8">
        <div className="flex justify-center">
          <ChefHat size={48} className="text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-primary mt-4">Restaurant Ordering System</h1>
        {selectedTable && selectedRestaurant && (
          <div className="mt-2">
            <p className="text-gray-600">
              {selectedRestaurant.name} - Table #{selectedTable}
            </p>
            <button
              onClick={handleReset}
              className="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-primary bg-white border border-primary hover:bg-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <LogOut size={16} className="mr-1" />
              Reset Table
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full">
        {!selectedRestaurant ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-primary text-white">
              <h2 className="text-xl font-semibold">Select a Restaurant</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {restaurants.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500">No restaurants available</p>
                </div>
              ) : (
                restaurants.map((restaurant) => (
                  <button
                    key={restaurant.id}
                    onClick={() => handleRestaurantSelect(restaurant)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center"
                  >
                    <div className="flex-shrink-0 mr-4">
                      {restaurant.logo ? (
                        <img 
                          src={restaurant.logo} 
                          alt={restaurant.name} 
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <ChefHat size={24} className="text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{restaurant.name}</h3>
                      {restaurant.address && (
                        <p className="text-sm text-gray-500">{restaurant.address}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-primary text-white flex justify-between items-center">
              <h2 className="text-xl font-semibold">Select a Table</h2>
              <button
                onClick={() => setSelectedRestaurant(null)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                Back
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {tables.length === 0 ? (
                  <div className="col-span-3 p-6 text-center">
                    <p className="text-gray-500">No tables available</p>
                  </div>
                ) : (
                  tables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table)}
                      className={`p-4 rounded-lg border-2 ${
                        table.status === 'available'
                          ? 'border-primary hover:bg-primary/10'
                          : table.status === 'reserved'
                          ? 'border-yellow-500 hover:bg-yellow-50 opacity-75'
                          : 'border-red-500 hover:bg-red-50 opacity-75'
                      } transition-colors flex flex-col items-center justify-center`}
                      disabled={table.status !== 'available'}
                    >
                      <Table size={24} className={
                        table.status === 'available'
                          ? 'text-primary'
                          : table.status === 'reserved'
                          ? 'text-yellow-500'
                          : 'text-red-500'
                      } />
                      <span className="mt-2 font-medium">
                        {table.name || `Table ${table.number}`}
                      </span>
                      <span className="text-xs text-gray-500">
                        #{table.number}
                      </span>
                      <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
                        table.status === 'available'
                          ? 'bg-primary/10 text-primary'
                          : table.status === 'reserved'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {table.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TableSelection;