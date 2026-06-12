import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export type CustomerInput = Omit<
  Customer,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `customer_name.ilike.${term},manager_name.ilike.${term},business_type.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(
  input: CustomerInput,
  userEmail: string,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...input, created_by: userEmail, updated_by: userEmail })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
  userEmail: string,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

/** 고객사명으로 조회, 없으면 신규 생성 후 반환 */
export async function findOrCreateCustomer(
  customerName: string,
  userEmail: string,
): Promise<Customer> {
  const trimmed = customerName.trim();
  if (!trimmed) {
    throw new Error('고객사명을 입력해 주세요.');
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('customer_name', trimmed);

  if (error) throw error;

  const exact = (data ?? []).find(
    (c) => c.customer_name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return exact;

  return createCustomer(
    {
      customer_name: trimmed,
      manager_name: '',
      phone: '',
      company_email: '',
      personal_email: '',
      address: '',
      business_type: '',
      memo: '',
    },
    userEmail,
  );
}
