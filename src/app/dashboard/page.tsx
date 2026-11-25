import { createSessionToken, getUser, getUserFromToken, parseSessionToken } from '@/lib/auth';
import DashboardSession from '@/components/dashboard-session';
import SessionRecovery from '@/components/session-recovery';
import { demoAccountById } from '@/lib/demo';
import { loadDashboardData } from '@/lib/dashboard';
import { getCommunityData, threadName } from '@/lib/community';
import { getOrCreateWallet, walletTransactionsFor, activeEscrowsFor, pendingWithdrawalsFor } from '@/lib/wallet';
import { isPaystackConfigured } from '@/lib/paystack';
import { loadProviderDocuments, loadPendingDocuments } from '@/lib/verification';
import { DashboardShell, normalizeWorkspaceTab, visibleTabs, type WorkspaceRole } from '@/components/dashboard-shell';
import LiveDashboard from '@/components/live-dashboard';
import DemoDashboard from '@/components/demo-dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

function relative(date: Date) {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(date);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; success?: string; error?: string; notice?: string; t?: string; thread?: string }> }) {
  const params = await searchParams;
  const user = (await getUser()) || (await getUserFromToken(params.t));
  if (!user) return <SessionRecovery />;
  const sessionToken = parseSessionToken(params.t) ? params.t! : createSessionToken(user.id);
  const role: WorkspaceRole = user.role === 'admin' ? 'admin' : user.role === 'provider' ? 'provider' : 'customer';
  const demo = demoAccountById(user.id);
  const tab = demo ? (visibleTabs(role, true).includes(params.tab as never) ? params.tab! : 'overview') : normalizeWorkspaceTab(role, params.tab);
  if (demo) return <DashboardShell role={role} name={user.name} email={user.email} tab={tab} demo><DashboardSession token={sessionToken}/><DemoDashboard key={`${demo.role}-${tab}`} role={demo.role} email={demo.email} initialTab={tab} notice={params.notice}/></DashboardShell>;
  const [data, community] = await Promise.all([loadDashboardData(user), getCommunityData(user.id, role)]);
  const [walletData, walletTxs, escrows, pendingDocs, providerDocuments] = await Promise.all([
    getOrCreateWallet(user.id),
    walletTransactionsFor(user.id, 25),
    activeEscrowsFor(role, user.id, data.provider?.id || null),
    role === 'admin' ? loadPendingDocuments() : Promise.resolve([]),
    data.provider ? loadProviderDocuments(data.provider.id) : Promise.resolve([]),
  ]);
  const adminWithdrawals = role === 'admin' ? await pendingWithdrawalsFor() : [];
  const threads = community.threads.map(thread => {
    const messages = community.messages.filter(m => m.threadId === thread.id);
    const last = messages[messages.length - 1];
    const customer = community.users.find(u => u.id === thread.customerId);
    const name = role === 'admin' && thread.kind === 'support' ? `Support · ${customer?.name || 'User'}` : threadName(thread, community.providers, community.users);
    return { id: thread.id, name, subject: thread.subject, kind: thread.kind, preview: last?.body || 'No messages yet', updatedAt: relative(last?.createdAt || thread.createdAt), status: thread.status };
  });
  const selectedThreadId = params.thread && threads.some(t => t.id === params.thread) ? params.thread : threads[0]?.id;
  const selectedThread = selectedThreadId ? community.threads.find(t => t.id === selectedThreadId) : undefined;
  const initialMessages = selectedThread ? community.messages.filter(m => m.threadId === selectedThread.id).map(message => {
    const sender = community.users.find(u => u.id === message.senderId);
    return { id: message.id, body: message.body, senderId: message.senderId, sender: message.senderId === user.id ? 'You' : sender?.role === 'admin' ? 'KUFIX Customer Care' : sender?.name || 'Participant', createdAt: message.createdAt.toISOString() };
  }) : [];
  return <DashboardShell role={role} name={user.name} email={user.email} tab={tab} demo={false}><DashboardSession token={sessionToken}/><LiveDashboard user={user} role={role} tab={tab} data={data} community={community} threads={threads} selectedThreadId={selectedThreadId} initialMessages={initialMessages} token={sessionToken} success={params.success} error={params.error} wallet={walletData} walletTxs={walletTxs} escrows={escrows} providerDocuments={providerDocuments} pendingDocuments={pendingDocs} adminWithdrawals={adminWithdrawals} paystackEnabled={isPaystackConfigured()}/></DashboardShell>;
}
