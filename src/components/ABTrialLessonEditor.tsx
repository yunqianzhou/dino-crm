import { Alert, Card, Descriptions, Form, Select, Space, Tag, Typography } from 'antd'
import type { UnitContent } from '../appConfigModel'
import type { Target } from '../abTestConfig'
import { trialLessonVersions, trialLessonVersion, trialLessonLabel, trialLessonErrors } from '../appTrialLessonConfig'
export default function ABTrialLessonEditor({content,onChange,readOnly=false,target,experiment=false,legacy=false}:{content:UnitContent;onChange:(c:UnitContent)=>void;readOnly?:boolean;target:Target;experiment?:boolean;legacy?:boolean}){
 const id=content.details.settings.lessonVersionId,version=trialLessonVersion(id),errors=trialLessonErrors(id,target)
 if(legacy)return <Card title="体验课版本"><Alert type="info" showIcon message="此记录未保存体验课版本" description="该历史方案沿用当时的 App 体验课配置，无法据此确定具体版本。"/></Card>
 return <Card title={<Space>体验课版本<Tag color="blue">页面沿用 App</Tag></Space>}>
 <Typography.Paragraph type="secondary">{experiment?'各实验组从创建时的基础方案复制体验课版本，可在本组独立选择。实验开启后版本固定，不随基础配置更新。':'为此基础方案选择体验课版本；未参加体验课实验的用户使用匹配的线上基础配置。'}</Typography.Paragraph>
 <Form layout="vertical"><Form.Item label="体验课版本" required extra="只选择已发布且可用的课程版本；不自定义体验课页面内容。"><Select aria-label="体验课版本" disabled={readOnly} value={typeof id==='string'?id:undefined} style={{width:'100%',maxWidth:520}} options={[...trialLessonVersions.filter(v=>v.status==='PUBLISHED'||v.id===id).map(v=>({value:v.id,label:`${trialLessonLabel(v.id)}${v.status==='PUBLISHED'?'（示例）':'（已停用）'}`,disabled:v.status!=='PUBLISHED'})),...(!version&&id?[{value:String(id),label:trialLessonLabel(id),disabled:true}]:[])]} onChange={lessonVersionId=>onChange({...content,details:{...content.details,settings:{...content.details.settings,lessonVersionId}}})}/></Form.Item></Form>
 {version&&<Descriptions bordered size="small" column={1} items={[{key:'version',label:'版本编号',children:version.version},{key:'name',label:'版本名称',children:version.name},{key:'notes',label:'版本说明',children:version.summary},{key:'compatibility',label:'兼容 App 版本',children:`≥ ${version.minAppVersion}`}]} />}
 {!!errors.length&&<Alert style={{marginTop:16}} showIcon type="error" message={errors.join(' ')}/>}
 <Alert style={{marginTop:16}} type="info" showIcon message="已有未完成体验课继续使用原版本；新开始的体验课使用当前有效配置。"/>
 <Typography.Paragraph type="secondary" style={{margin:'16px 0 0'}}>当前版本目录为原型演示数据，正式版本列表及兼容信息待接入课程服务。</Typography.Paragraph>
 </Card>
}
