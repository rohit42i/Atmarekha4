
import { memo, useEffect, useState } from 'react';

const ICONS = {
  overview:['M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-11h6V4h-6v5Z'],
  analytics:['M5 19V9m7 10V5m7 14v-7'],
  chapters:['M5 4.5h11A2.5 2.5 0 0 1 18.5 7v12a1 1 0 0 1-1 1H7a2.5 2.5 0 0 1-2.5-2.5v-13Z','M7.5 17.5h8'],
  pages:['M6 3.5h9.5L19 7v13.5H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5V7h4'],
  moderation:['M12 3 20 6v5c0 4.8-3.1 8.7-8 10-4.9-1.3-8-5.2-8-10V6l8-3Z','m9.2 12.1 1.7 1.7 4-4'],
  community:['M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H11l-4.5 4v-4.5A2.5 2.5 0 0 1 4 12V5.5Z'],
  users:['M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20','M9.5 10.5A3.5 3.5 0 1 0 9.5 3a3.5 3.5 0 0 0 0 7.5Zm5-6a3 3 0 0 1 0 5.8'],
  finance:['M4 6h16v12H4z','M4 9h16','M8 14h3'],
  settings:['M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z','M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.5 1.5-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2H13v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.5-1.5.1-.1A1.7 1.7 0 0 0 9 15a1.7 1.7 0 0 0-1.6-1H7v-2h.4A1.7 1.7 0 0 0 9 11a1.7 1.7 0 0 0-.3-1.9l-.1-.1L10.1 7l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2v.2a1.7 1.7 0 0 0 1-1.6 1.7 1.7 0 0 0 1.9.3l.1-.1 1.5 1.5-.1.1A1.7 1.7 0 0 0 18 11c.2.6.8 1 1.4 1h.6v2h-.6a1.7 1.7 0 0 0-1.6 1Z'],
  search:['m21 21-4.3-4.3','M10.8 18a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z'],
  bell:['M18 9.5c0-3.4-2.1-5.7-6-5.7s-6 2.3-6 5.7c0 4.5-1.8 5.7-1.8 5.7h15.6S18 14 18 9.5Z','M10 19h4'],
  chevron:['m9 6 6 6-6 6'],
  chevronDown:['m7 10 5 5 5-5'],
  plus:['M12 5v14M5 12h14'],
  refresh:['M20 11a8 8 0 1 0 1 4','M20 5v6h-6'],
  sparkles:['M12 3 13.3 8.7 19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3Z','m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z'],
  eye:['M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z','M12 14.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z'],
  heart:['M20.8 8.8c0 5.1-8.8 9.5-8.8 9.5S3.2 13.9 3.2 8.8A4.2 4.2 0 0 1 11 6.5a4.2 4.2 0 0 1 7.8 2.3Z'],
  message:['M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3.5A2 2 0 0 1 3 13V6a2 2 0 0 1 2-2Z'],
  share:['M7 12h10','m13 6 6 6-6 6'],
  star:['m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L3 9.7l6.2-.9L12 3Z'],
  bookmark:['M6 4h12v16l-6-3.7L6 20V4Z'],
  activity:['M3 12h4l2-6 4 12 2-6h6'],
  logout:['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4','m15 17 5-5-5-5','M20 12H9'],
  menu:['M4 7h16M4 12h16M4 17h16'],
  close:['m6 6 12 12M18 6 6 18'],
  shield:['M12 3 20 6v5c0 4.8-3.1 8.7-8 10-4.9-1.3-8-5.2-8-10V6l8-3Z'],
};

export const Icon = memo(function Icon({name,size=18,strokeWidth=1.8,className=''}) {
  const paths = ICONS[name] || ICONS.overview;
  return <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={strokeWidth} strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' className={className}>{paths.map(function(d,i){ return <path d={d} key={i}/>; })}</svg>;
});

export const GlassCard = memo(function GlassCard({children,className='',as:Tag='section'}) {
  return <Tag className={'ar-glass-card '+className}>{children}</Tag>;
});

export const SectionHeader = memo(function SectionHeader({eyebrow,title,description,action,actionLabel}) {
  return <div className='ar-section-header'><div>{eyebrow && <span className='ar-eyebrow'>{eyebrow}</span>}<h3>{title}</h3>{description && <p>{description}</p>}</div>{action && <button type='button' className='ar-section-action' onClick={action}>{actionLabel || 'View all'} <Icon name='chevron' size={15}/></button>}</div>;
});

export function AnimatedNumber({value=0,formatter}) {
  const target = Number(value || 0);
  const [display,setDisplay] = useState(target);
  useEffect(function(){ let raf=0; const start=display; const started=performance.now(); const duration=650; const tick=function(now){ const p=Math.min(1,(now-started)/duration); const eased=1-Math.pow(1-p,3); setDisplay(start+(target-start)*eased); if(p<1) raf=requestAnimationFrame(tick); }; raf=requestAnimationFrame(tick); return function(){ cancelAnimationFrame(raf); }; },[target]);
  return <span>{formatter ? formatter(display) : Math.round(display).toLocaleString('en-IN')}</span>;
}

export function Delta({value}) {
  if(!Number.isFinite(Number(value))) return <span className='ar-delta neutral'>—</span>;
  const n=Number(value), positive=n>=0;
  return <span className={'ar-delta '+(positive?'positive':'negative')}><span>{positive?'↑':'↓'}</span> {Math.abs(n).toFixed(1)}%</span>;
}

export const StatCard = memo(function StatCard({label,value,delta,icon='activity',tone='violet',note,formatter}) {
  return <article className={'ar-stat-card tone-'+tone}><div className='ar-stat-top'><span>{label}</span><span className='ar-stat-icon'><Icon name={icon} size={17}/></span></div><strong><AnimatedNumber value={value} formatter={formatter}/></strong><div className='ar-stat-bottom'>{delta!=null?<Delta value={delta}/>:<span className='ar-stat-note'>{note || 'All time'}</span>}{delta!=null&&note?<span className='ar-stat-note'>{note}</span>:null}</div><span className='ar-stat-glow' aria-hidden='true'/></article>;
});

export const Skeleton = memo(function Skeleton({className=''}) {
  return <div className={'ar-skeleton '+className} aria-hidden='true'/>;
});

export const Avatar = memo(function Avatar({name='Reader',src}) {
  const initial=String(name||'R').trim().slice(0,1).toUpperCase();
  return src?<img className='ar-avatar ar-avatar-md' src={src} alt='' loading='lazy'/>:<span className='ar-avatar ar-avatar-md' aria-hidden='true'>{initial}</span>;
});

export function Donut({segments,center,label}) {
  const total=Math.max(segments.reduce(function(sum,item){return sum+Math.max(0,Number(item.value||0));},0),1);
  let cursor=0;
  const stops=segments.map(function(item){ const value=Math.max(0,Number(item.value||0)); const start=(cursor/total)*360; cursor+=value; const end=(cursor/total)*360; return item.color+' '+start+'deg '+end+'deg'; });
  return <div className='ar-donut-wrap'><div className='ar-donut' style={{background:'conic-gradient('+stops.join(',')+')'}}><div className='ar-donut-hole'><strong>{center}</strong><span>{label}</span></div></div><div className='ar-donut-legend'>{segments.map(function(item){return <div key={item.label}><span style={{background:item.color}}/><div><b>{item.label}</b><small>{item.valueLabel || item.value}</small></div></div>;})}</div></div>;
}

function buildPoints(series,accessor){
  const values=series.map(function(item){return Number(accessor(item)||0);});
  const max=Math.max.apply(null,values.concat([1]));
  const left=34,right=704,top=30,bottom=250;
  const step=series.length>1?(right-left)/(series.length-1):0;
  return values.map(function(value,i){return {x:left+step*i,y:bottom-(value/max)*(bottom-top),value:value,raw:series[i]};});
}
function linePath(points){ return points.map(function(p,i){return (i?'L':'M')+' '+p.x.toFixed(1)+' '+p.y.toFixed(1);}).join(' '); }

export function DualAreaChart({series,labels=[]}) {
  const safe=Array.isArray(series)?series:[];
  if(!safe.length) return <div className='ar-chart-empty'><Icon name='analytics' size={20}/><span>Not enough time-series data yet.</span><small>The dashboard uses the selected-period comparison until daily analytics are available.</small></div>;
  const primary=buildPoints(safe,function(item){return item.views;});
  const secondary=buildPoints(safe,function(item){return item.engagement;});
  const primaryArea=linePath(primary)+' L '+primary[primary.length-1].x.toFixed(1)+' 250 L '+primary[0].x.toFixed(1)+' 250 Z';
  const secondaryArea=linePath(secondary)+' L '+secondary[secondary.length-1].x.toFixed(1)+' 250 L '+secondary[0].x.toFixed(1)+' 250 Z';
  return <div className='ar-area-chart'><svg viewBox='0 0 738 288' role='img' aria-label='Views and engagement chart'><defs><linearGradient id='arPrimaryFill' x1='0' x2='0' y1='0' y2='1'><stop offset='0%' stopColor='#8b5cf6' stopOpacity='.28'/><stop offset='100%' stopColor='#8b5cf6' stopOpacity='0'/></linearGradient><linearGradient id='arSecondaryFill' x1='0' x2='0' y1='0' y2='1'><stop offset='0%' stopColor='#ec4899' stopOpacity='.16'/><stop offset='100%' stopColor='#ec4899' stopOpacity='0'/></linearGradient></defs>{[0,1,2,3].map(function(i){return <line key={i} x1='34' x2='704' y1={30+i*73.3} y2={30+i*73.3} className='ar-chart-grid'/>;})}<path d={secondaryArea} fill='url(#arSecondaryFill)'/><path d={primaryArea} fill='url(#arPrimaryFill)'/><path d={linePath(secondary)} className='ar-chart-line secondary'/><path d={linePath(primary)} className='ar-chart-line primary'/>{primary.map(function(p,i){return <circle key={'p'+i} cx={p.x} cy={p.y} r='3.6' className='ar-chart-dot primary'/>;})}{secondary.map(function(p,i){return <circle key={'s'+i} cx={p.x} cy={p.y} r='3' className='ar-chart-dot secondary'/>;})}</svg><div className='ar-chart-labels'>{safe.map(function(item,i){return <span key={i}>{labels[i]||item.label||''}</span>;})}</div><div className='ar-chart-legend'><span><i className='primary'/>Views</span><span><i className='secondary'/>Engagement</span></div></div>;
}
