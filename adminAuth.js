import { supabase } from './supabase';

export async function getAdminRole(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('admins')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role === 'owner' || data?.role === 'admin' ? data.role : null;
}

export async function getCurrentAdminRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };
  return { user, role: await getAdminRole(user.id) };
}

export function isAdminRole(role) {
  return role === 'owner' || role === 'admin';
}
