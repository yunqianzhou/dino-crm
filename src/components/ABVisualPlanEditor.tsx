import { useState } from 'react'
import { Alert, Button, Card, Collapse, Empty, Select, Space, Tag, Typography } from 'antd'
import { ArrowRightOutlined, CheckOutlined } from '@ant-design/icons'
import { labels, languages, templates } from '../abTestConfig'
import type { Target } from '../abTestConfig'
import { extractContent, getSlot, registry } from '../appConfigModel'
import { fullPlan } from '../appBusinessConfig'
import type { VisualPlan } from '../appBusinessConfig'
import ABPageEditor from './ABPageEditor'
import ABUnitEditor from './ABUnitEditor'

export default function ABVisualPlanEditor({value,onChange,readOnly=false,target}:{value:VisualPlan;onChange:(p:VisualPlan)=>void;readOnly?:boolean;target:Target}) {
 const [node,setNode]=useState(value.contents[value.flowId]?.steps?.[0]??'auth'),[language,setLanguage]=useState('zh'),[member,setMember]=useState(false)
 const flow=getSlot(value.flowId),steps=value.contents[value.flowId]?.steps??[],slots=registry.filter(s=>s.node===node&&!s.flow),plan=fullPlan(value)
 const update=(contents:VisualPlan['contents'])=>{if(!readOnly)onChange({...value,contents:{...value.contents,...contents}})}
 const pick=(n:string)=>{setNode(n);setMember(false)}
 return <div className="ab-plan-editor">
  <div className="ab-section-title"><h3>选择首次使用流程</h3><Typography.Text type="secondary">点击流程节点，配置对应页面</Typography.Text></div>
  <div className="ab-template-grid">{templates.map(t=>{const id=`app.flow.${t.id.replace(/-/g,'_')}`;return <button key={id} className={`ab-template ${value.flowId===id?'is-active':''}`} disabled={readOnly} aria-pressed={value.flowId===id} onClick={()=>{onChange({...value,flowId:id});pick(value.contents[id]?.steps?.[0]??'auth')}}><div><span>{t.badge}</span>{value.flowId===id&&<CheckOutlined/>}</div><h3>{t.name}</h3><p>{t.id==='double-paywall'?'购买页在课前、课后各出现一次；点击购买时先登录。':t.desc}</p></button>})}</div>
  <Card size="small" title="流程与页面" style={{margin:'16px 0'}} extra={<Typography.Text type="secondary">点击页面开始编辑</Typography.Text>}>
   <div className="ab-flow">{steps.map((n,i)=><div className="ab-flow-item" key={`${i}-${n}`}><button className={node===n?'selected':''} onClick={()=>pick(n)}><span>{String(i+1).padStart(2,'0')}</span>{labels[n]}{registry.some(s=>s.node===n)&&<i/>}</button>{i<steps.length-1&&<ArrowRightOutlined/>}</div>)}</div>
   <div className="ab-retention-entry"><Typography.Text type="secondary">其他页面</Typography.Text>{['value','auth','retention-promo','retention-regular'].filter(n=>!steps.includes(n)).map(n=><Button key={n} size="small" type={node===n?'primary':'default'} onClick={()=>pick(n)}>{labels[n]}</Button>)}</div>
   <Collapse ghost size="small" items={[{key:'sequence',label:'调整流程顺序',children:<ABUnitEditor slot={flow} content={value.contents[value.flowId]} target={target} readOnly={readOnly} onChange={c=>update({[value.flowId]:c})}/>}]}/>
  </Card>
  <div className="ab-plan-toolbar"><Space><strong>{labels[node]}</strong><Tag color="blue">页面配置与实时预览</Tag></Space><Select aria-label="预览语言" value={language} onChange={setLanguage} options={languages} style={{width:190}}/></div>
  {slots.length?<>
   {node==='paywall'&&<Space style={{marginBottom:16}}><Button type={!member?'primary':'default'} onClick={()=>setMember(false)}>页面图文与按钮</Button><Button type={member?'primary':'default'} onClick={()=>setMember(true)}>会员档位、权益与周期</Button></Space>}
   {node==='paywall'&&member?<ABUnitEditor slot={slots.find(s=>s.members)!} content={value.contents[slots.find(s=>s.members)!.id]} target={target} readOnly={readOnly} onChange={c=>update({[slots.find(s=>s.members)!.id]:c})}/>:<ABPageEditor key={`${node}-${value.flowId}`} appMode plan={plan} node={node} target={target} readOnly={readOnly} language={language} sectionKeys={[...new Set(slots.filter(s=>!s.members).map(s=>s.section))]} onChange={p=>update(Object.fromEntries(slots.filter(s=>!s.members).map(s=>[s.id,extractContent(p,s)])))}/>}
   <Collapse ghost size="small" items={[{key:'notes',label:'页面配置说明',children:<ul>{slots.filter(s=>s.pending).map(s=><li key={s.id}>{s.pending}</li>)}</ul>}]}/>
  </>:<Card><Empty description={`${labels[node]}沿用 App 现有页面，无需配置页面素材。`}/></Card>}
  <Alert type="info" showIcon style={{marginTop:16}} message="图片、文案、选项和译文保存在当前方案中；切换页面不会丢失编辑内容。"/>
 </div>
}
