import { useState } from 'react'
import { Alert, Button, Card, Collapse, Drawer, Empty, Select, Space, Tag, Typography } from 'antd'
import { ArrowRightOutlined, CheckOutlined } from '@ant-design/icons'
import { labels, languages } from '../abTestConfig'
import type { Target } from '../abTestConfig'
import { extractContent, registry } from '../appConfigModel'
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
 return <div className="ab-plan-editor">
  <div className="ab-section-title"><h3>选择首次使用流程</h3><Typography.Text type="secondary">点击流程节点，配置对应页面</Typography.Text></div>
  <div className="ab-template-grid ab-two-standards">{flowStandards.map((t,i)=><button key={t.id} className={`ab-template ${graph.standard===t.standard?'is-active':''}`} disabled={readOnly} aria-pressed={graph.standard===t.standard} onClick={()=>{onChange({...value,flowId:t.id});pick(value.contents[t.id]?.flow?.nodes[0]?.page??(i===0?'auth':'value'))}}><div><span>标准 {i+1}</span>{graph.standard===t.standard&&<CheckOutlined/>}</div><h3>{t.name}</h3><p>{t.desc}</p></button>)}</div>
  <Card size="small" title="流程与页面" style={{margin:'16px 0'}} extra={<Button type="primary" onClick={()=>setFlowOpen(true)}>{readOnly?'查看流程与分支':'配置流程与分支'}</Button>}>
   <div className="ab-flow">{units.map((unit,i)=><div className="ab-flow-item" key={unit.nodes[0].id}>{unit.onboarding?<div className="ab-onboarding-module"><div className="ab-onboarding-caption"><strong>{String(i+1).padStart(2,'0')} 资料采集</strong><span>内部顺序固定</span></div><div className="ab-onboarding-pages">{unit.nodes.map((n,j)=><div className="ab-flow-item" key={n.id}><button className={node===n.page?'selected':''} onClick={()=>pick(n.page)}>{labels[n.page]}<i/></button>{j<unit.nodes.length-1&&<ArrowRightOutlined/>}</div>)}</div></div>:<button className={node===unit.nodes[0].page?'selected':''} onClick={()=>pick(unit.nodes[0].page)}><span>{String(i+1).padStart(2,'0')}</span>{labels[unit.nodes[0].page]}{registry.some(s=>s.node===unit.nodes[0].page)&&<i/>}</button>}{i<units.length-1&&<ArrowRightOutlined/>}</div>)}</div>
   <div className="ab-retention-entry"><Typography.Text type="secondary">其他页面</Typography.Text>{['value','auth','retention-promo','retention-regular'].filter(n=>!steps.includes(n)).map(n=><Button key={n} size="small" type={node===n?'primary':'default'} onClick={()=>pick(n)}>{labels[n]}</Button>)}</div>
   <Typography.Paragraph type="secondary" style={{margin:'12px 0 0'}}>资料采集为整体模块，内部按固定顺序展示；点击其中的页面可配置内容。点击“配置流程与分支”调整模块位置和支付路径。</Typography.Paragraph>
  </Card>
  <div className="ab-plan-toolbar"><Space><strong>{labels[node]}</strong><Tag color="blue">页面配置与实时预览</Tag></Space><Select aria-label="预览语言" value={language} onChange={setLanguage} options={languages} style={{width:190}}/></div>
  {slots.length?<>
   {node==='paywall'&&<Space style={{marginBottom:16}}><Button type={!member?'primary':'default'} onClick={()=>setMember(false)}>页面图文与按钮</Button><Button type={member?'primary':'default'} onClick={()=>setMember(true)}>会员档位、权益与周期</Button></Space>}
   {node==='paywall'&&member?<ABUnitEditor slot={slots.find(s=>s.members)!} content={value.contents[slots.find(s=>s.members)!.id]} target={target} readOnly={readOnly} onChange={c=>update({[slots.find(s=>s.members)!.id]:c})}/>:<ABPageEditor key={`${node}-${value.flowId}`} appMode plan={plan} node={node} target={target} readOnly={readOnly} language={language} sectionKeys={[...new Set(slots.filter(s=>!s.members).map(s=>s.section))]} onChange={p=>update(Object.fromEntries(slots.filter(s=>!s.members).map(s=>[s.id,extractContent(p,s)])))}/>}
   <Collapse ghost size="small" items={[{key:'notes',label:'页面配置说明',children:<ul>{slots.filter(s=>s.pending).map(s=><li key={s.id}>{s.pending}</li>)}</ul>}]}/>
  </>:<Card><Empty description={`${labels[node]}沿用 App 现有页面，无需配置页面素材。`}/></Card>}
  <Alert type="info" showIcon style={{marginTop:16}} message="图片、文案、选项和译文保存在当前方案中；切换页面不会丢失编辑内容。"/>
  <Drawer title="配置流程与支付分支" width="92vw" open={flowOpen} onClose={()=>setFlowOpen(false)} footer={<Button type="primary" onClick={()=>setFlowOpen(false)}>完成</Button>}>{readOnly&&!value.contents[value.flowId]?.flow&&<Alert type="info" showIcon style={{marginBottom:16}} message="历史版本只保存了页面顺序。以下分支按当前规则演示，不代表历史 App 已执行这些规则。"/>}<ABFlowEditor value={graph} readOnly={readOnly} onChange={flow=>update({[value.flowId]:{...flowContent,flow,steps:flow.nodes.map(n=>n.page)}})}/></Drawer>
 </div>
}
