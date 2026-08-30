import React, { useEffect, useState } from 'react';

const actions = [
  ['Refresh', 'Refresh current admin data', 'refresh'],
  ['Overview', 'Return to Command Center', 'focus'],
  ['Reports', 'Review moderation queue', 'reports'],
  ['Community', 'Manage community content', 'community'],
  ['Chapters', 'Manage manga chapters', 'chapters'],
  ['Users', 'Manage reader accounts', 'users'],
];

export default function AdminMobileTools(){
  const [notice,setNotice]=useState('');
  useEffect(()=>{ if(!notice) return; const t=setTimeout(()=>setNotice(''),1800); return()=>clearTimeout(t)},[notice]);
  const run=(type)=>{
    if(type==='refresh'){ window.dispatchEvent(new CustomEvent('atma-admin-refresh')); setNotice('Refresh requested'); return; }
    if(type==='focus'){ document.querySelector('.admin-overview,.admin-command-center,.ar-command-panel')?.scrollIntoView({behavior:'smooth',block:'start'}); setNotice('Command Center'); return; }
    const selectors={reports:'.admin-moderation-tools,.admin-report-list',community:'.community-admin,.admin-community',chapters:'.admin-chapter-list,.admin-chapters',users:'.admin-management-tools,.admin-user-list'};
    const el=document.querySelector(selectors[type]);
    if(el){el.scrollIntoView({behavior:'smooth',block:'start'});setNotice('Opened '+type);}
    else setNotice('Tool is available below');
  };
  return <>
    <section className="admin-mobile-tools" aria-label="Admin quick actions">
      {actions.map(([title,desc,type],i)=><button key={type} type="button" className={'admin-mobile-tool '+(i===0?'primary':'')} onClick={()=>run(type)}><strong>{title}</strong><span>{desc}</span></button>)}
    </section>
    {notice && <div className="admin-mobile-toast" role="status">{notice}</div>}
  </>;
}
