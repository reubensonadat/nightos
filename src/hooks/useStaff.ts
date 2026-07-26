import { useState } from 'react';
import { db, type DbStaff } from '../lib/api';

const MOCK_VENUE_ID = '00000000-0000-0000-0000-000000000000';

const MOCK_STAFF: Record<string, DbStaff> = {
  '+233000000000': {
    id: 'mock-s1',
    venue_id: MOCK_VENUE_ID,
    name: 'Akosua Owusu',
    phone: '+233000000000',
    email: 'akosua@velvetlounge.gh',
    role: 'manager',
    pin: '000000',
    is_active: true,
    max_tables: 0,
    area_assignment: null,
    hourly_rate: 45,
    created_at: new Date().toISOString(),
  },
  '+233000000001': {
    id: 'mock-s2',
    venue_id: MOCK_VENUE_ID,
    name: 'Kojo Mensah',
    phone: '+233000000001',
    email: 'kojo@velvetlounge.gh',
    role: 'waiter',
    pin: '000000',
    is_active: true,
    max_tables: 6,
    area_assignment: 'Main Floor',
    hourly_rate: 25,
    created_at: new Date().toISOString(),
  },
  '+233000000002': {
    id: 'mock-s3',
    venue_id: MOCK_VENUE_ID,
    name: 'Kwame Asante',
    phone: '+233000000002',
    email: 'kwame@velvetlounge.gh',
    role: 'kitchen',
    pin: '000000',
    is_active: true,
    max_tables: 0,
    area_assignment: null,
    hourly_rate: 28,
    created_at: new Date().toISOString(),
  },
  '+233000000003': {
    id: 'mock-s4',
    venue_id: MOCK_VENUE_ID,
    name: 'Kwesi Adjei',
    phone: '+233000000003',
    email: 'kwesi@velvetlounge.gh',
    role: 'bar',
    pin: '000000',
    is_active: true,
    max_tables: 0,
    area_assignment: 'Bar',
    hourly_rate: 28,
    created_at: new Date().toISOString(),
  },
};

type StaffState = {
  staff: DbStaff | null;
  loading: boolean;
  error: string | null;
  signIn: (phone: string, pin: string) => Promise<DbStaff | null>;
  signOut: () => void;
};

export function useStaff(): StaffState {
  const [staff, setStaff] = useState<DbStaff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (phone: string, pin: string): Promise<DbStaff | null> => {
    setLoading(true);
    setError(null);

    let staffMember: DbStaff | null = null;

    const { data, error: dbError } = await db.staffByPhone(phone);
    if (data && !dbError) staffMember = data;

    if (!staffMember) {
      const mock = MOCK_STAFF[phone];
      if (mock && mock.pin === pin) staffMember = mock;
    }

    if (!staffMember) {
      setError('Staff not found');
      setLoading(false);
      return null;
    }

    if (!staffMember.is_active) {
      setError('Account is deactivated');
      setLoading(false);
      return null;
    }

    if (staffMember.pin !== pin) {
      setError('Invalid PIN');
      setLoading(false);
      return null;
    }

    setStaff(staffMember);
    setLoading(false);
    return staffMember;
  };

  const signOut = () => {
    setStaff(null);
    setError(null);
  };

  return { staff, loading, error, signIn, signOut };
}
