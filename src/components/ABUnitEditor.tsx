import { useState } from 'react'
import { Alert, Select, Space, Typography } from 'antd'
import { contentPlan, extractContent, defaultMembers } from '../appConfigModel'
import type { Slot, UnitContent } from '../appConfigModel'
import { labels } from '../abTestConfig'
import type { Target } from '../abTestConfig'
import { productLanguages } from '../appProductCopy'
import ABPageEditor from './ABPageEditor'
import ABMemberEditor from './ABMemberEditor'
import ABFlowEditor from './ABFlowEditor'
import { makeFlow, flowStandard } from '../appFlowConfig'
export default function ABUnitEditor({slot,content,onChange,readOnly=false,target}:{slot:Slot;content:UnitContent;onChange:(c:UnitContent)=>void;readOnly?:boolean;target:Target}){
 const [language,setLanguage]=useState(content.baseLanguage??'zh')
 if(slot.flow&&readOnly&&!content.flow)return <><Alert type="info" message="历史版本仅保存页面顺序，未包含支付分支配置。"/><ol>{(content.steps??[]).map((page,i)=><li key={`${i}-${page}`}>{labels[page]??page}</li>)}</ol></>
 if(slot.flow)return <ABFlowEditor value={content.flow??makeFlow(content.steps??[],flowStandard(slot.id))} readOnly={readOnly} onChange={flow=>onChange({...content,flow,steps:flow.nodes.map(n=>n.page)})}/>
 const translated=content.pageTranslations?.[language]?.[slot.node]??{}
 return <><Space style={{width:'100%',justifyContent:'space-between',marginBottom:16}}><strong>{slot.page} / {slot.name}</strong><Select aria-label="预览语言" disabled={slot.lists?.includes('names')} value={language} onChange={setLanguage} options={productLanguages} style={{width:200}}/></Space>{slot.pending&&<Alert type="warning" showIcon message={slot.pending} style={{marginBottom:16}}/>}{slot.members?<ABMemberEditor value={content.details.members??defaultMembers()} readOnly={readOnly} language={language} baseLanguage={content.baseLanguage??'zh'} onChange={members=>onChange({...content,details:{...content.details,members}})} text={(key,base)=>language===(content.baseLanguage??'zh')?base:translated[key]??base} onText={(key,value)=>onChange({...content,pageTranslations:{...content.pageTranslations,[language]:{...content.pageTranslations?.[language],[slot.node]:{...translated,[key]:value}}}})}/>:<ABPageEditor key={slot.id} plan={contentPlan(content,slot)} node={slot.node} language={language} target={target} readOnly={readOnly} appMode sectionKeys={[slot.section]} onlyFields={[...(slot.copy??[]),...(slot.texts??[]),...(slot.lists??[])]} onChange={plan=>onChange(extractContent(plan,slot))}/>}<Typography.Paragraph type="secondary" style={{marginTop:16}}>文字与译文随该配置版本保存；正式多语言平台、素材服务与 APP 字典尚未接入。预览不模拟实际注册或支付。</Typography.Paragraph></>
}
