import React, { useEffect, useState } from 'react';

const actions = [
  ['Refresh', 'Refresh current admin data', 'refresh'],
  ['Overview', 'Return to Command Center', 'overview'],
  ['Reports', 'Review moderation queue', 'reports'],
  ['Community', 'Manage community content', 'community'],
  ['Chapters', 'Manage manga chapters', 'chapters'],
  ['Users', 'Manage reader accounts', 'users'],
];

const findAdminTab = title => Array.from(document.querySelectorAll('.admin-tabs button, .admin-tabs [role="tab"], .admin-tab')).find(el => el.textContent?.trim().toLowerCase() === title.toLowerCase());
const clickFirst = selectors => { for (const selector of selectors) { const el = document.querySelector(selector); if (el) { el.click(); return true; } } return false; };

export default function AdminMobileTools(){
  const [notice,setNotice]=useState('');
  useEffect(()=>{ if(!notice) return; const t=setTimeout(()=>setNotice(''),1800); return()=>clearTimeout(t)},[notice]);
  const run=(type)=>{
    if(type==='refresh'){
      window.dispatchEvent(new CustomEvent('atma-admin-refresh'));
      window.dispatchEvent(new CustomEvent('atma-public-refresh'));
      window.location.reload();
      return;
    }
    const names={overview:'Overview',reports:'Reports',community:'Community',chapters:'Chapters',users:'Users'};
    const tab=findAdminTab(names[type]);
    if(tab){ tab.click(); tab.scrollIntoView({behavior:'smooth',block:'start'}); setNotice('Opened '+names[type]); return; }
    const fallbacks={
      overview:['.admin-overview','.admin-command-center','.ar-command-tab'],
      reports:['.ar-mod-launch','.admin-moderation-launch','.admin-report-list','.admin-moderation-tools'],
      community:['.community-admin-launch','.admin-community-launch','.community-admin','.admin-community'],
      chapters:['.admin-chapters-launch','.admin-chapter-list','.admin-chapters'],
      users:['.admin-users-launch','.admin-management-launch','.admin-user-list','.admin-management-tools']
    };
    if(clickFirst(fallbacks[type]||[])){ setNotice('Opened '+names[type]); return; }
    const eventName={overview:'atma-admin-overview',reports:'atma-admin-reports',community:'atma-admin-community',chapters:'atma-admin-chapters',users:'atma-admin-users'}[type];
    if(eventName) window.dispatchEvent(new CustomEvent(eventName));
    setNotice('Opening '+names[type]);
  };
  return <>
    <section className="admin-mobile-tools" aria-label="Admin quick actions">
      {actions.map(([title,desc,type],i)=><button key={type} type="button" className={'admin-mobile-tool '+(i===0?'primary':'')} onClick={()=>run(type)}><strong>{title}</strong><span>{desc}</span></button>)}
    </section>
    {notice && <div className="admin-mobile-toast" role="status">{notice}</div>}
  </>;
}
