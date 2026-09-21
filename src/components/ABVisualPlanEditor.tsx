import { useState } from 'react'
import { Alert, Button, Card, Collapse, Drawer, Empty, Select, Space, Tag, Typography } from 'antd'
import { ApartmentOutlined, CheckOutlined, LockOutlined } from '@ant-design/icons'
import { labels, languages } from '../abTestConfig'
import type { Target } from '../abTestConfig'
import { extractContent, registry, validateContent } from '../appConfigModel'
import { fullPlan, effectiveContent } from '../appBusinessConfig'
import type { VisualPlan } from '../appBusinessConfig'
import ABPageEditor from './ABPageEditor'
import ABUnitEditor from './ABUnitEditor'
import ABFlowEditor from './ABFlowEditor'
import { flowStandards, flowUnits } from '../appFlowConfig'

export default function ABVisualPlanEditor({value,onChange,readOnly=false,target}:{value:VisualPlan;onChange:(p:VisualPlan)=>void;readOnly?:boolean;target:Target}) {
 const [node,setNode]=useState(value.contents[value.flowId]?.steps?.[0]??'auth'),[language,setLanguage]=useState('zh'),[member,setMember]=useState(false),[flowOpen,setFlowOpen]=useState(false)
 const flowContent=effectiveContent(value,value.flowId),graph=flowContent.flow!,steps=graph.nodes.map(n=>n.page),units=flowUnits(graph.nodes),slots=registry.filter(s=>s.node===node&&!s.flow),plan=fullPlan(value)
 const update=(contents:VisualPlan['contents'])=>{if(!readOnly)onChange({...value,contents:{...value.contents,...contents}})}
 const pick=(n:string)=>{setNode(n);setMember(false)}
 const pageIssues=(page:string)=>registry.filter(s=>s.node===page&&!s.flow).flatMap(s=>validateContent(s,effectiveContent(value,s.id)))
 const issues=pageIssues(node),otherPages=['value','auth','retention-promo','retention-regular'].filter(n=>!steps.includes(n))
 const pageButton=(page:string,index?:number)=>{const errors=pageIssues(page),editable=registry.some(s=>s.node===page&&!s.flow);return <button type="button" className={`ab-nav-page ${node===page?'is-selected':''}`} aria-current={node===page?'page':undefined} onClick={()=>pick(page)}><span className="ab-nav-index">{index===undefined?'':String(index+1).padStart(2,'0')}</span><span>{labels[page]}</span>{errors.length?<span className="ab-nav-error" aria-label={`${errors.length} 项待完善`}>{errors.length}</span>:!editable?<span className="ab-nav-native">App</span>:node===page?<CheckOutlined/>:null}</button>}
 return <div className="ab-plan-editor ab-content-workspace">
  <div className="ab-standard-toolbar"><div><span className="ab-toolbar-label">首次使用流程</span><div className="ab-standard-switch" role="group" aria-label="首次使用流程标准">{flowStandards.map((t,i)=><button type="button" key={t.id} disabled={readOnly} aria-pressed={graph.standard===t.standard} className={graph.standard===t.standard?'is-active':''} onClick={()=>{onChange({...value,flowId:t.id});pick(value.contents[t.id]?.flow?.nodes[0]?.page??(i===0?'auth':'value'))}}>{t.name}</button>)}</div></div><Button icon={<ApartmentOutlined/>} onClick={()=>setFlowOpen(true)}>{readOnly?'查看流程与分支':'配置流程与分支'}</Button></div>
  <div className="ab-content-layout">
   <aside className="ab-page-directory" aria-label="页面目录"><div className="ab-directory-heading"><strong>流程页面</strong><span>{units.length} 个模块</span></div><nav aria-label="选择配置页面">{units.map((unit,i)=><div key={unit.nodes[0].id}>{unit.onboarding?<div className="ab-nav-module"><div className="ab-nav-module-title"><span>{String(i+1).padStart(2,'0')} 资料采集</span><LockOutlined title="内部顺序固定"/></div><div className="ab-nav-module-pages">{unit.nodes.map(n=><div key={n.id}>{pageButton(n.page)}</div>)}</div></div>:pageButton(unit.nodes[0].page,i)}</div>)}</nav><div className="ab-directory-heading ab-directory-secondary"><strong>关联页面</strong></div>{otherPages.map(page=><div key={page}>{pageButton(page)}</div>)}<p className="ab-directory-note">资料采集内部顺序固定。标记 App 的页面沿用客户端行为。</p></aside>
   <section className="ab-page-workarea" aria-label="页面内容编辑"><div className="ab-content-toolbar"><div><h3>{labels[node]}</h3><Typography.Text type="secondary">{readOnly?'只读查看页面内容':'编辑图文、素材与选项，修改实时反映在预览中'}</Typography.Text></div><Select aria-label="编辑与预览语言" value={language} onChange={setLanguage} options={languages} style={{width:175}}/></div>
    {!!issues.length&&<Alert type="error" showIcon className="ab-page-issues" message={`当前页面有 ${issues.length} 项待完善`} description={<ul>{[...new Set(issues)].map(issue=><li key={issue}>{issue}</li>)}</ul>}/>}
    {slots.length?<>
     {node==='paywall'&&<Space className="ab-paywall-sections"><Button type={!member?'primary':'default'} onClick={()=>setMember(false)}>页面图文与按钮</Button><Button type={member?'primary':'default'} onClick={()=>setMember(true)}>会员档位、权益与周期</Button></Space>}
     {node==='paywall'&&member?<ABUnitEditor slot={slots.find(s=>s.members)!} content={value.contents[slots.find(s=>s.members)!.id]} target={target} readOnly={readOnly} onChange={c=>update({[slots.find(s=>s.members)!.id]:c})}/>:<ABPageEditor key={`${node}-${value.flowId}`} appMode compact expandAll={issues.length>0} plan={plan} node={node} target={target} readOnly={readOnly} language={language} sectionKeys={[...new Set(slots.filter(s=>!s.members).map(s=>s.section))]} onChange={p=>update(Object.fromEntries(slots.filter(s=>!s.members).map(s=>[s.id,extractContent(p,s)])))}/>}
     {slots.some(s=>s.pending)&&<Collapse ghost size="small" items={[{key:'notes',label:'配置说明与接入状态',children:<ul>{slots.filter(s=>s.pending).map(s=><li key={s.id}>{s.pending}</li>)}</ul>}]}/>}
    </>:<Card className="ab-native-page"><Empty description={`${labels[node]}沿用 App 现有页面，无需配置页面素材。`}/><Button onClick={()=>setFlowOpen(true)}>查看在流程中的位置</Button></Card>}
   </section>
  </div>
  <Drawer title="流程编排与支付分支" width="94vw" open={flowOpen} onClose={()=>setFlowOpen(false)} footer={<div className="ab-drawer-footer"><Typography.Text type="secondary">修改保留在当前草稿；回到编辑页后保存或提交。</Typography.Text><Button type="primary" onClick={()=>setFlowOpen(false)}>完成编排</Button></div>}>{readOnly&&!value.contents[value.flowId]?.flow&&<Alert type="info" showIcon style={{marginBottom:16}} message="历史版本只保存了页面顺序。以下分支按当前规则演示，不代表历史 App 已执行这些规则。"/>}<ABFlowEditor value={graph} readOnly={readOnly} onChange={flow=>update({[value.flowId]:{...flowContent,flow,steps:flow.nodes.map(n=>n.page)}})}/></Drawer>
 </div>
}
