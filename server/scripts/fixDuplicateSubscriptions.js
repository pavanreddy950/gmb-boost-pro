import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabaseConfig from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

async function fixDuplicateSubscriptions() {
  try {
    console.log('🔧 Fixing Duplicate Subscriptions...\n');
    
    // Initialize Supabase first
    await supabaseConfig.initialize();
    const supabase = supabaseConfig.getClient();
    
    // Get all subscriptions
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: true }); // Oldest first
    
    if (error) throw error;
    
    console.log(`📊 Total subscriptions found: ${subscriptions.length}`);
    
    // Group by email to find duplicates
    const byEmail = {};
    subscriptions.forEach(sub => {
      if (!byEmail[sub.email]) {
        byEmail[sub.email] = [];
      }
      byEmail[sub.email].push(sub);
    });
    
    console.log('\n📧 Analyzing duplicates...');
    
    const toDelete = [];
    const toKeep = [];
    
    for (const [email, subs] of Object.entries(byEmail)) {
      if (subs.length > 1) {
        console.log(`\n❌ DUPLICATE: ${email} (${subs.length} subscriptions)`);
        
        // Sort by priority: active > trial > expired
        const sorted = subs.sort((a, b) => {
          const priorityOrder = { 'active': 3, 'paid': 3, 'trial': 2, 'expired': 1, 'cancelled': 1 };
          const aPriority = priorityOrder[a.status] || 0;
          const bPriority = priorityOrder[b.status] || 0;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
          }
          
          // If same status, prefer newer created_at
          return new Date(b.created_at) - new Date(a.created_at);
        });
        
        const keep = sorted[0]; // Keep the highest priority/newest
        const duplicates = sorted.slice(1); // Delete the rest
        
        console.log(`   ✅ KEEP: ${keep.status} (${keep.profile_count || 0} profiles) - ID: ${keep.id}`);
        duplicates.forEach(dup => {
          console.log(`   ❌ DELETE: ${dup.status} (${dup.profile_count || 0} profiles) - ID: ${dup.id}`);
          toDelete.push(dup.id);
        });
        
        toKeep.push(keep);
      } else {
        console.log(`✅ OK: ${email} (1 subscription)`);
        toKeep.push(subs[0]);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Keep: ${toKeep.length} subscriptions`);
    console.log(`   Delete: ${toDelete.length} duplicates`);
    
    if (toDelete.length > 0) {
      console.log(`\n🗑️ Deleting ${toDelete.length} duplicate subscriptions...`);
      
      const { error: deleteError } = await supabase
        .from('subscriptions')
        .delete()
        .in('id', toDelete);
      
      if (deleteError) throw deleteError;
      
      console.log('✅ Duplicates deleted successfully!');
    } else {
      console.log('\n✅ No duplicates to delete');
    }
    
    console.log('\n🔍 Final verification...');
    const { data: finalSubs, error: finalError } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (finalError) throw finalError;
    
    console.log(`\n📊 CLEAN SUBSCRIPTIONS: ${finalSubs.length}`);
    finalSubs.forEach((sub, i) => {
      console.log(`${i+1}. ${sub.email}: ${sub.status} (${sub.profile_count || 0} profiles)`);
    });
    
    console.log('\n✅ Subscription cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixDuplicateSubscriptions().then(() => process.exit(0));
