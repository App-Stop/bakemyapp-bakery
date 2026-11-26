import { useState } from 'react'
import { useTenant } from '../../lib/TenantContext'
import { WorkspaceHeader, WorkspaceTabs } from '../shared/WorkspaceUI'
import { Faqs } from './Faqs'
import { Tickets } from './Tickets'
import { Chats } from './Chats'

export function SupportView({ initialTab = 'tickets' }) {
  const { user } = useTenant()
  const [tab, setTab] = useState(initialTab)
  if (!['tenant_owner', 'tenant_manager'].includes(user.role)) return null
  return <div className="workspace-page"><WorkspaceHeader title="Customer support" description="Manage help content, resolve requests and talk with customers." /><WorkspaceTabs label="Support sections" options={[["faqs", "FAQs"], ["tickets", "Requests"], ["chats", "Live chats"]]} value={tab} onChange={setTab} />{tab === 'faqs' ? <Faqs /> : tab === 'chats' ? <Chats /> : <Tickets />}</div>
}
