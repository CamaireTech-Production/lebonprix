import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { db } from '../../../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Contact, Order } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import ContactListContent from '../../../shared/ContactListContent';

const ContactsPage: React.FC = () => {
  const { restaurant } = useAuth();
  useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search] = useState('');
  const [sortBy] = useState<'count' | 'name' | 'phone'>('count');
  const [sortDir] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (!restaurant?.id) return;
    setLoading(true);
    const q = query(collection(db, 'orders'), where('restaurantId', '==', restaurant.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, [restaurant]);

  // Aggregate contacts
  const contacts: Contact[] = useMemo(() => {
    const map = new Map<string, Contact & { names: string[]; lastOrderDate: any[] }>();
    for (const order of orders) {
      const phone = order.customerPhone?.trim();
      if (!phone) continue;
      const name = order.customerName?.trim() || '';
      const location = order.customerLocation?.trim() || '';
      const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      if (!map.has(phone)) {
        map.set(phone, { phone, name, location, count: 1, lastOrderDate: date, names: name ? [name] : [] });
      } else {
        const entry = map.get(phone)!;
        entry.count++;
        entry.names.push(name);
        // Update location if more recent
        if (date > entry.lastOrderDate) {
          entry.lastOrderDate = date;
          if (name) entry.name = name;
          if (location) entry.location = location;
        }
      }
    }
    // For each contact, set name to most recent non-empty name
    return Array.from(map.values()).map(c => ({
      phone: c.phone,
      name: c.names.reverse().find(n => n) || '',
      location: c.location,
      count: c.count,
      lastOrderDate: c.lastOrderDate,
    }));
  }, [orders]);

  // Filter and sort
  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.phone.includes(s) || c.name.toLowerCase().includes(s));
    }
    list = list.slice().sort((a, b) => {
      if (sortBy === 'count') return sortDir === 'desc' ? b.count - a.count : a.count - b.count;
      if (sortBy === 'name') return sortDir === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      if (sortBy === 'phone') return sortDir === 'desc' ? b.phone.localeCompare(a.phone) : a.phone.localeCompare(b.phone);
      return 0;
    });
    return list;
  }, [contacts, search, sortBy, sortDir]);

  return (
    <DashboardLayout title="">
      <ContactListContent contacts={filteredContacts} loading={loading} restaurant={restaurant} />
    </DashboardLayout>
  );
};

export default ContactsPage; 