import { supabase } from './supabase';

export const buildChapters = async () => {
    try {
        const { data, error } = await supabase
            .from('chapters')
            .select('*')
            .order('chapter_number', { ascending: true });

        if (error) throw error;

        // Convert Supabase chapters into the format your website expects
        return (data || []).map((ch) => ({
            id: ch.id,
            num: `Ch. ${ch.chapter_number}`,
            title: ch.title,
            date: new Date(ch.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        }));
    } catch (err) {
        console.error('Error fetching chapters:', err);
        return [];
    }
};
