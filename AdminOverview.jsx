
import { useEffect, useMemo, useState } from 'react';
import { getPublicReaderTiers, supabase } from './supabase';
import SubscriberBadge from './SubscriberBadge.jsx';
import { Avatar, Donut, DualAreaChart, GlassCard, Icon, SectionHeader, StatCard } from './admin-premium-ui.jsx';

const WINDOWS={today:1,week:7,month:30,range:90};
const formatNumber=value=>Number(value||0).toLocaleString('en-IN');
const compactNumber=value=>{const n=Number(value||0);if(n>=1000000)return (n/1000000).toFixed(1).replace('.0','')+'M';if(n>=1000)return (n/1000).toFixed(1).replace('.0','')+'K';return formatNumber(n);};
const pct=(current,previous)=>!previous?(current?100:0):((current-previous)/previous)*100;
const isoDay=value=>{const d=new Date(value||0);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';};
const shortDay=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}):String(value||'');};

function buildComparison(data){
  const previousEngagement=Number(data.previous_likes||0)+Number(data.previous_shares||0)+Number(data.previous_comments||0)+Number(data.previous_ratings||0);
  const currentEngagement=Number(data.current_likes||0)+Number(data.current_shares||0)+Number(data.current_comments||0)+Number(data.current_ratings||0);
  return [{label:'Previous',views:Number(data.previous_views||0),engagement:previousEngagement},{label:'Current',views:Number(data.current_views||0),engagement:currentEngagement}];
}
function buildTimeSeries(data){
  const candidate=data&&(
    data.daily_series||data.timeseries||data.series||data.activity_series||data.daily
  );
  if(!Array.isArray(candidate)||candidate.length<2)return [];
  return candidate.map(function(item){
    return {label:item.label||item.date||item.day||'',views:Number(item.views??item.current_views??item.view_count??0),engagement:Number(item.engagement??(Number(item.likes||0)+Number(item.shares||0)+Number(item.comments||0)+Number(item.ratings||0)))};
  }).filter(function(item){return item.views||item.engagement;});
}

export default function AdminOverview({chapters,comments,reports=[],ratings,views,likes,pageCounts,onTab,chapterName}){
  const [periodKey,setPeriodKey]=useState('month');
  const [membershipPlans,setMembershipPlans]=useState(new Map());
  const [userStats,setUserStats]=useState({logged_in_users:0,notification_subscriptions:0});
  const [analytics,setAnalytics]=useState(null);
  const [last24,setLast24]=useState({views:0,ratings:0,comments:0,loading:true});
  const days=WINDOWS[periodKey];

  useEffect(function(){
    let active=true;
    const ids=[...new Set((comments||[]).map(function(comment){return comment.user_id;}).filter(Boolean))];
    if(!ids.length){setMembershipPlans(new Map());return function(){active=false;};}
    getPublicReaderTiers(ids).then(function(map){if(active)setMembershipPlans(map);}).catch(function(error){console.warn('Admin membership badge lookup failed:',error);if(active)setMembershipPlans(new Map());});
    return function(){active=false;};
  },[comments]);

  useEffect(function(){
    let active=true;
    const loadUserStats=async function(){
      try{const result=await supabase.functions.invoke('get-admin-user-stats');if(result.error)throw result.error;if(active&&result.data)setUserStats({logged_in_users:Number(result.data.logged_in_users||0),notification_subscriptions:Number(result.data.notification_subscriptions||0)});}
      catch(error){console.warn('Admin user stats lookup failed:',error);}
    };
    loadUserStats();
    const interval=setInterval(loadUserStats,30000);
    const onVisibilityChange=function(){if(document.visibilityState==='visible')loadUserStats();};
    document.addEventListener('visibilitychange',onVisibilityChange);
    return function(){active=false;clearInterval(interval);document.removeEventListener('visibilitychange',onVisibilityChange);};
  },[]);

  useEffect(function(){
    let active=true;
    const loadLast24=async function(){
      try{const result=await supabase.rpc('get_admin_analytics',{p_days:1});if(result.error)throw result.error;if(active)setLast24({views:Number(result.data?.current_views||0),ratings:Number(result.data?.current_ratings||0),comments:Number(result.data?.current_comments||0),loading:false});}
      catch(error){console.warn('Admin 24-hour activity lookup failed:',error);if(active)setLast24(function(current){return {...current,loading:false};});}
    };
    loadLast24();
    const interval=setInterval(loadLast24,60000);
    const onVisibilityChange=function(){if(document.visibilityState==='visible')loadLast24();};
    document.addEventListener('visibilitychange',onVisibilityChange);
    return function(){active=false;clearInterval(interval);document.removeEventListener('visibilitychange',onVisibilityChange);};
  },[]);

  useEffect(function(){
    let active=true;
    const loadAnalytics=async function(){
      try{const result=await supabase.rpc('get_admin_analytics',{p_days:days});if(result.error)throw result.error;if(active)setAnalytics(result.data||null);}
      catch(error){console.warn('Admin analytics lookup failed:',error);if(active)setAnalytics(null);}
    };
    loadAnalytics();
    return function(){active=false;};
  },[days]);

  const metrics=useMemo(function(){
    const data=analytics||{};
    const totalRatings=Number(data.total_ratings||0);
    const totalAverage=totalRatings?Number(data.rating_sum||0)/totalRatings:0;
    const currentViews=Number(data.current_views||0),previousViews=Number(data.previous_views||0);
    const currentLikes=Number(data.current_likes||0),previousLikes=Number(data.previous_likes||0);
    const currentShares=Number(data.current_shares||0),previousShares=Number(data.previous_shares||0);
    const currentComments=Number(data.current_comments||0),previousComments=Number(data.previous_comments||0);
    const currentRatings=Number(data.current_ratings||0),previousRatings=Number(data.previous_ratings||0);
    const chapterStats=(data.chapter_stats||[]).map(function(chapter){return {...chapter,views:Number(chapter.views||0),periodViews:Number(chapter.period_views||0),likes:Number(chapter.likes||0),periodLikes:Number(chapter.period_likes||0),shares:Number(chapter.shares||0),periodShares:Number(chapter.period_shares||0),ratingCount:Number(chapter.rating_count||0),ratingAverage:Number(chapter.rating_average||0),pages:Number(chapter.pages||pageCounts?.[chapter.id]||0)};});
    const ratingCounts=Array.from({length:10},function(_,i){const rating=10-i;const match=(data.rating_counts||[]).find(function(row){return Number(row.rating)===rating;});return {rating:rating,count:Number(match?.count||0)};});
    const engagementCurrent=currentLikes+currentShares+currentComments+currentRatings;
    const engagementPrevious=previousLikes+previousShares+previousComments+previousRatings;
    const published=(chapters||[]).filter(function(ch){return String(ch.status||'').toLowerCase()==='published';});
    const healthyPublished=published.filter(function(ch){return Number(pageCounts?.[ch.id]||ch.pages||0)>0;}).length;
    const openReports=(reports||[]).filter(function(r){return (r.status||'open')==='open';}).length;
    const health=published.length?Math.max(0,Math.round(healthyPublished/published.length*100)-Math.min(openReports*4,20)):100;
    return {
      totalViews:Number(data.total_views||0),totalLikes:Number(data.total_likes||0),totalShares:Number(data.total_shares||0),
      totalRatings:totalRatings,totalComments:Number(data.total_comments||0),totalAverage:totalAverage,
      viewsDelta:pct(currentViews,previousViews),likesDelta:pct(currentLikes,previousLikes),sharesDelta:pct(currentShares,previousShares),commentsDelta:pct(currentComments,previousComments),
      currentViews:currentViews,currentLikes:currentLikes,currentShares:currentShares,currentComments:currentComments,currentRatings:currentRatings,currentEngagement:engagementCurrent,engagementDelta:pct(engagementCurrent,engagementPrevious),
      activeReaders:Number(data.active_readers||0),returningReaders:Number(data.returning_readers||0),bookmarks:Number(data.bookmarks||0),released:Number(data.released||0),publishedCount:published.length,
      chapterStats:chapterStats,ratingCounts:ratingCounts,health:health,
      recentComments:[...(comments||[])].sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);}).slice(0,5),
      topChapters:[...chapterStats].sort(function(a,b){return (b.periodViews-a.periodViews) || (b.views-a.views);}).slice(0,6)
    };
  },[analytics,chapters,comments,pageCounts,reports]);

  const timeSeries=useMemo(function(){return buildTimeSeries(analytics);},[analytics]);
  const chartSeries=timeSeries.length?timeSeries:buildComparison(analytics||{});
  const periodLabel=periodKey==='today'?'Today':periodKey==='week'?'This week':periodKey==='month'?'This month':'Last 90 days';

  const calendar=useMemo(function(){
    const map=new Map(),now=new Date();
    for(let i=27;i>=0;i-=1){const date=new Date(now);date.setDate(now.getDate()-i);map.set(isoDay(date),0);}
    (comments||[]).forEach(function(item){const key=isoDay(item.created_at);if(map.has(key))map.set(key,map.get(key)+2);});
    (chapters||[]).forEach(function(item){const key=isoDay(item.releaseDate||item.release_date||item.createdAt);if(map.has(key))map.set(key,map.get(key)+3);});
    const max=Math.max(...map.values(),1);
    return [...map.entries()].map(function(entry){const value=entry[1];return {key:entry[0],value:value,level:value?Math.min(4,Math.ceil(value/max*4)):0};});
  },[chapters,comments]);

  const engagementSegments=[
    {label:'Views',value:metrics.currentViews,valueLabel:compactNumber(metrics.currentViews),color:'#8b5cf6'},
    {label:'Likes',value:metrics.currentLikes,valueLabel:compactNumber(metrics.currentLikes),color:'#a78bfa'},
    {label:'Shares',value:metrics.currentShares,valueLabel:compactNumber(metrics.currentShares),color:'#ec4899'},
    {label:'Comments',value:metrics.currentComments,valueLabel:compactNumber(metrics.currentComments),color:'#f472b6'},
    {label:'Ratings',value:metrics.currentRatings,valueLabel:compactNumber(metrics.currentRatings),color:'#22c55e'}
  ].filter(function(item){return item.value>0;});

  const insights=useMemo(function(){
    const items=[];
    items.push(metrics.currentViews?'Views reached '+formatNumber(metrics.currentViews)+' in '+periodLabel.toLowerCase()+', '+(metrics.viewsDelta>=0?'up ':'down ')+Math.abs(metrics.viewsDelta).toFixed(1)+'% from the previous period.':'Traffic data is still building for this period.');
    if(metrics.topChapters[0])items.push((metrics.topChapters[0].chapterNumber?'Chapter '+metrics.topChapters[0].chapterNumber:'Your top chapter')+' is leading the selected-period view count.');
    items.push(formatNumber(metrics.returningReaders)+' returning readers are a useful signal for repeat readership.');
    items.push(metrics.health>=90?'Content health is stable across the currently published library.':'Content health needs attention: review incomplete chapters and the moderation queue.');
    return items;
  },[metrics,periodLabel]);

  const nextReleases=useMemo(function(){return [...(chapters||[])].filter(function(ch){return ch.releaseDate&&new Date(ch.releaseDate).getTime()>Date.now();}).sort(function(a,b){return new Date(a.releaseDate)-new Date(b.releaseDate);}).slice(0,4);},[chapters]);
  const maxRating=Math.max(...metrics.ratingCounts.map(function(item){return item.count;}),1);
  const openReportCount=(reports||[]).filter(function(r){return (r.status||'open')==='open';}).length;

  return <section className='ar-dashboard' id='analytics-section'>
    <div className='ar-welcome'>
      <div><span className='ar-eyebrow'>ATMA REKHA / ADMIN</span><h2>Welcome back, Admin <span aria-hidden='true'>👋</span></h2><p>Here’s the pulse of your manga platform at a glance.</p></div>
      <div className='ar-period-switcher' role='tablist' aria-label='Dashboard period'>{Object.keys(WINDOWS).map(function(key){return <button key={key} type='button' className={periodKey===key?'active':''} onClick={function(){setPeriodKey(key);}}>{key==='today'?'Today':key==='week'?'Week':key==='month'?'Month':'Range'}</button>;})}</div>
    </div>

    <div className='ar-stat-grid'>
      <StatCard label='Total views' value={metrics.totalViews} delta={metrics.viewsDelta} icon='eye' tone='violet'/>
      <StatCard label='Active readers' value={metrics.activeReaders} note={periodLabel+' unique readers'} icon='users' tone='indigo'/>
      <StatCard label='Returning readers' value={metrics.returningReaders} note='Readers seen on 2+ days' icon='activity' tone='pink'/>
      <StatCard label='Bookmarks' value={metrics.bookmarks} note='Saved chapter bookmarks' icon='bookmark' tone='violet'/>
      <StatCard label='Avg rating' value={metrics.totalAverage} formatter={function(v){return Number(v).toFixed(2)+' / 10';}} note={formatNumber(metrics.totalRatings)+' ratings'} icon='star' tone='green'/>
      <StatCard label='Comments' value={metrics.totalComments} delta={metrics.commentsDelta} icon='message' tone='pink'/>
      <StatCard label='Logged-in users' value={userStats.logged_in_users} note='Registered accounts' icon='users' tone='indigo'/>
      <StatCard label='Notifications on' value={userStats.notification_subscriptions} note='Push subscriptions' icon='bell' tone='violet'/>
      <StatCard label='Total shares' value={metrics.totalShares} delta={metrics.sharesDelta} icon='share' tone='pink'/>
      <StatCard label='Published chapters' value={metrics.publishedCount} note={formatNumber(metrics.released)+' released in '+periodLabel.toLowerCase()} icon='chapters' tone='green'/>
    </div>

    <div className='ar-feature-grid'>
      <GlassCard className='ar-hero-chart'>
        <SectionHeader eyebrow='PERFORMANCE' title='Views & engagement' description={periodLabel+' compared with the previous period'}/>
        <div className='ar-chart-summary'><div><span>Views</span><strong>{compactNumber(metrics.currentViews)}</strong></div><div><span>Engagement</span><strong>{compactNumber(metrics.currentEngagement)}</strong></div><div className='ar-chart-delta'>{metrics.engagementDelta>=0?'↑':'↓'} {Math.abs(metrics.engagementDelta).toFixed(1)}% engagement</div></div>
        <DualAreaChart series={chartSeries} labels={chartSeries.map(function(item){return timeSeries.length?shortDay(item.label):item.label;})}/>
      </GlassCard>

      <GlassCard className='ar-calendar-card'>
        <SectionHeader eyebrow='ACTIVITY' title='Publishing & community' description='A 28-day view of observable admin activity.'/>
        <div className='ar-calendar'>{calendar.map(function(item){return <span key={item.key} className={'level-'+item.level} title={item.key+': '+item.value+' activity'}/>;})}</div>
        <div className='ar-calendar-legend'><span>Less</span><i className='level-0'/><i className='level-1'/><i className='level-2'/><i className='level-3'/><i className='level-4'/><span>More</span></div>
        <div className='ar-calendar-footer'><div><span>Published chapters</span><strong>{metrics.publishedCount}</strong></div><div><span>Comments tracked</span><strong>{formatNumber((comments||[]).length)}</strong></div></div>
      </GlassCard>
    </div>

    <div className='ar-grid-3'>
      <GlassCard className='ar-bars-card'>
        <SectionHeader eyebrow='CONTENT' title='Top chapter performance' action={function(){onTab('Chapters');}} actionLabel='Manage chapters'/>
        <div className='ar-bars-list'>{metrics.topChapters.map(function(chapter,index){
          const max=Math.max(...metrics.topChapters.map(function(item){return item.periodViews||item.views;}),1),value=chapter.periodViews||chapter.views;
          return <button type='button' key={chapter.id} onClick={function(){onTab('Chapters');}} className='ar-bar-row'><span className='ar-bar-rank'>{String(index+1).padStart(2,'0')}</span><span className='ar-bar-label'><b>{chapter.chapterNumber?'Chapter '+chapter.chapterNumber:'Unnumbered'}</b><small>{chapter.title||'Untitled'}</small><i><em style={{width:Math.max(5,value/max*100)+'%'}}/></i></span><strong>{compactNumber(value)}</strong></button>;
        })}{!metrics.topChapters.length&&<div className='ar-empty-state'>No chapter analytics yet.</div>}</div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow='ENGAGEMENT' title='Reader activity mix' description='Only metrics exposed by the current analytics contract.'/>
        {engagementSegments.length?<Donut segments={engagementSegments} center={compactNumber(metrics.currentEngagement)} label='signals'/>:<div className='ar-empty-state'>No engagement data yet.</div>}
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow='QUALITY' title='Content health'/>
        <div className='ar-health-ring' style={{'--health':(metrics.health*3.6)+'deg'}}><div><strong>{metrics.health}</strong><span>score</span></div></div>
        <div className='ar-health-copy'><div><span>Published chapters</span><b>{chapters.filter(function(ch){return String(ch.status||'').toLowerCase()==='published';}).length}</b></div><div><span>Open reports</span><b className={openReportCount?'bad':'good'}>{openReportCount}</b></div></div>
        <button type='button' className='ar-inline-button' onClick={function(){document.querySelector('.ar-health-tab')?.click();}}>Run chapter health check <Icon name='chevron' size={14}/></button>
      </GlassCard>
    </div>

    <div className='ar-grid-2'>
      <GlassCard>
        <SectionHeader eyebrow='COMMUNITY' title='Recent comments' action={function(){onTab('Comments');}} actionLabel='View all'/>
        <div className='ar-comments-list'>{metrics.recentComments.map(function(comment){return <article key={comment.id}><Avatar name={comment.author_name}/><div className='ar-comment-body'><div className='ar-comment-head'><div><strong>{comment.author_name||'Reader'}</strong> <SubscriberBadge planId={membershipPlans.get(comment.user_id)}/></div><time>{shortDay(comment.created_at)}</time></div><p>{comment.content}</p><span>{comment.announcement_id?'Announcement':chapterName(comment.chapter_id)}</span></div></article>;})}{!metrics.recentComments.length&&<div className='ar-empty-state'>No comments yet.</div>}</div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow='MODERATION' title='Queue preview' action={function(){onTab('Reports');}} actionLabel='Open reports'/>
        <div className='ar-queue-summary'><strong>{openReportCount}</strong><span>open reports</span><i><Icon name='shield' size={18}/></i></div>
        <div className='ar-queue-list'>{(reports||[]).filter(function(r){return (r.status||'open')==='open';}).slice(0,4).map(function(report){const comment=(comments||[]).find(function(item){return item.id===report.comment_id;});return <button type='button' key={report.id} onClick={function(){onTab('Reports');}}><span className='queue-dot'/><div><b>{comment?.author_name||'Reader'}</b><small>{report.reason||'Reported comment'}</small></div><Icon name='chevron' size={14}/></button>;})}{!openReportCount&&<div className='ar-empty-state'>Queue is clear.</div>}</div>
      </GlassCard>
    </div>

    <div className='ar-grid-3'>
      <GlassCard>
        <SectionHeader eyebrow='INSIGHTS' title='AI insights'/>
        <div className='ar-insights'>{insights.map(function(item,i){return <div key={i}><span><Icon name='sparkles' size={13}/></span><p>{item}</p></div>;})}</div>
        <small className='ar-data-note'>Generated from current admin metrics. No external model call.</small>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow='RELEASES' title='Upcoming chapters'/>
        <div className='ar-release-list'>{nextReleases.map(function(chapter){return <button type='button' key={chapter.id} onClick={function(){onTab('Chapters');}}><span className='ar-release-date'>{new Date(chapter.releaseDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span><div><b>{chapter.chapterNumber?'Chapter '+chapter.chapterNumber:'Untitled release'}</b><small>{chapter.title||'Scheduled chapter'}</small></div><Icon name='chevron' size={14}/></button>;})}{!nextReleases.length&&<div className='ar-empty-state'>No future releases scheduled.</div>}</div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow='RATINGS' title='Rating distribution'/>
        <div className='ar-rating-bars'>{metrics.ratingCounts.map(function(item){return <div key={item.rating}><span>{item.rating}</span><i><em style={{width:item.count/maxRating*100+'%'}}/></i><b>{item.count?Math.round(item.count/Math.max(metrics.totalRatings,1)*100):0}%</b></div>;})}</div>
      </GlassCard>
    </div>

    <GlassCard className='ar-live-strip'>
      <div className='ar-live-head'><div><span className='ar-live-dot'/> LIVE ACTIVITY <small>refreshes automatically</small></div><span>{periodLabel}</span></div>
      <div className='ar-live-grid'><div><Icon name='eye'/><span>Views</span><strong>{formatNumber(last24.loading?0:last24.views)}</strong><small>last 24h</small></div><div><Icon name='star'/><span>Ratings</span><strong>{formatNumber(last24.loading?0:last24.ratings)}</strong><small>last 24h</small></div><div><Icon name='message'/><span>Comments</span><strong>{formatNumber(last24.loading?0:last24.comments)}</strong><small>last 24h</small></div><div><Icon name='share'/><span>Shares</span><strong>{formatNumber(metrics.currentShares)}</strong><small>selected period</small></div></div>
    </GlassCard>
  </section>;
}
