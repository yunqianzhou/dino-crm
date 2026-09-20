const assert = require('node:assert/strict')
const {mkdtempSync,rmSync}=require('node:fs')
const {execFileSync}=require('node:child_process')
const {resolve,join}=require('node:path')
const {tmpdir}=require('node:os')
const dir=mkdtempSync(join(tmpdir(),'app-workbench-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'),['src/appConfigModel.ts','--outDir',dir,'--module','commonjs','--moduleResolution','node','--target','ES2020','--skipLibCheck'],{stdio:'inherit'})
 const m=require(join(dir,'appConfigModel.js'))
 const old=require(join(dir,'abTestConfig.js'))
 let s=m.seedAppStore()
 for(const slot of m.registry)assert.deepEqual(m.validateContent(slot,m.initialContent(slot)),[],`Initial content invalid: ${slot.id}`)
 const first=s.definitions[0],v1=m.latestVersion(s,first.id)
 const changed=old.clone(v1.content);changed.details.lists.slides[0].label='New title'
 s=m.saveVersion(s,first,changed,'1.9.0','Reviewer','Changed title')
 const v2=m.latestVersion(s,first.id)
 assert.equal(v2.no,2)
 assert.equal(m.compatibleVersion(s,first.id,'1.8.5').id,v1.id)
 assert.equal(m.compatibleVersion(s,first.id,'2.0.0').id,v2.id)
 assert.equal(m.compatibleVersion(s,first.id,'1.7.9'),undefined)
 changed.details.lists.slides[0].label='Unsaved change'
 assert.equal(v2.content.details.lists.slides[0].label,'New title')
 assert.notEqual(v1.content.details.lists.slides[0].label,'New title')
 assert.equal(v2.protocol.config.items[0].title_i18n_key.startsWith(`${first.id}.v2.`),true)
 assert.equal(v2.protocol.dictionary.zh[v2.protocol.config.items[0].title_i18n_key],'New title')
 assert.throws(()=>m.saveVersion(s,{...first,kind:'EXPERIMENT'},changed,'1.8.0','X',''),/不可修改/)
 const demoDef={...old.clone(first),id:old.makeId(),name:'Experiment copy',kind:'EXPERIMENT'}
 s=m.saveVersion(s,demoDef,old.clone(v1.content),'1.8.0','X','Experimental version')
 const expVersion=m.latestVersion(s,demoDef.id)
 const exp={id:old.makeId(),name:'Binding test',audience:m.audience(),minVersion:'1.8.0',status:'DRAFT',groups:[{id:'a',name:'A',weight:5000,control:true,bindings:[]},{id:'b',name:'B',weight:5000,control:false,bindings:[{definitionId:demoDef.id,versionId:expVersion.id}]}],startedAt:'',endedAt:'',salt:'test'}
 assert.deepEqual(m.validateExperiment(s,exp),[])
 s=m.saveExperimentDraft(s,exp,'X')
 assert.equal(m.relatedExperiments(s,demoDef.id).length,1)
 exp.groups[0].bindings=[{definitionId:demoDef.id,versionId:expVersion.id}]
 s=m.saveExperimentDraft(s,exp,'X')
 assert.equal(m.relatedExperiments(s,demoDef.id,expVersion.id).length,1,'Count unique experiments, not groups')
 s=m.transitionExperiment(s,exp.id,'READY','X')
 assert.throws(()=>m.saveExperimentDraft(s,exp,'X'),/冻结/)
 s=m.transitionExperiment(s,exp.id,'DRAFT','X')
 s=m.transitionExperiment(s,exp.id,'READY','X')
 s=m.transitionExperiment(s,exp.id,'RUNNING','X')
 const fixedVersion=s.experiments[0].groups[1].bindings[0].versionId
 s=m.saveVersion(s,demoDef,old.clone(v2.content),'1.9.0','X','New independent version')
 assert.equal(s.experiments[0].groups[1].bindings[0].versionId,fixedVersion)
 s=m.transitionExperiment(s,exp.id,'PAUSED','X')
 assert.throws(()=>m.setDefinitionStatus(s,demoDef.id,'DISABLED','X'),/引用/)
 s=m.transitionExperiment(s,exp.id,'RUNNING','X')
 s=m.transitionExperiment(s,exp.id,'ENDED','X')
 assert.throws(()=>m.transitionExperiment(s,exp.id,'RUNNING','X'),/不能/)
 assert.throws(()=>m.saveExperimentDraft(s,exp,'X'),/冻结/)
 const incompatible={...old.clone(exp),id:'incompatible',minVersion:'1.7.0'}
 assert(m.validateExperiment(s,incompatible).some(x=>x.includes('不能低于')))
 const wrongType=old.clone(exp);wrongType.groups[0].bindings=[{definitionId:first.id,versionId:v1.id}]
 assert(m.validateExperiment(s,wrongType).some(x=>x.includes('不可用')))
 const duplicate={...old.clone(s.releases[0]),id:'duplicate',status:'DRAFT'}
 assert(m.validateRelease(s,duplicate).some(x=>x.includes('重叠')))
 duplicate.audience.countries=['US']
 assert.deepEqual(m.validateRelease(s,duplicate),[])
 s=m.activateRelease(s,duplicate,'X')
 assert.throws(()=>m.activateRelease(s,{...duplicate,status:'DRAFT'},'X'),/不可直接修改/)
 const flow=m.getSlot('app.flow.double_paywall'),flowContent=m.initialContent(flow)
 assert.equal(flowContent.steps.filter(x=>x==='paywall').length,2)
 assert.deepEqual(m.validateContent(flow,flowContent),[])
 const wire=m.serializeContent(flow,flowContent,'flow').config
 assert(wire.steps.some(x=>x.page_sub_key==='app.onboarding.name'))
 assert.equal(wire.steps.filter(x=>x.page_key==='app.paywall_main').length,2)
 flowContent.steps[0]='home';assert(m.validateContent(flow,flowContent).length)
 const guide=m.getSlot('app.onboarding.name.dino_guide'),guideContent=m.initialContent(guide)
 guideContent.details.settings.showGuide=false
 const guideWire=m.serializeContent(guide,guideContent,'guide').config
 assert.equal(guideWire.text_tts_url,'');assert.equal(guideWire.asset_url,'');assert.equal(guideWire.text_i18n_key,'')
 const slide=m.getSlot('app.value.slideshow'),invalidSlide=m.initialContent(slide)
 invalidSlide.details.lists.slides=[];assert(m.validateContent(slide,invalidSlide).some(x=>x.includes('至少')))
 const methods=m.getSlot('app.login.methods'),methodContent=m.initialContent(methods)
 methodContent.details.settings.subMethods=['google'];assert(m.validateContent(methods,methodContent).some(x=>x.includes('重复')))
 const member=m.getSlot('app.paywall_main.member_plan_gourp'),memberWire=m.serializeContent(member,m.initialContent(member),'member').config
 assert.equal(memberWire.items[0].products.subscribe_cycles_items[0].cycles,'MONTH')
 assert.equal(memberWire.items[0].content_resource.resource_items.rows[0].values.pro,'INCLUDED')
 assert(JSON.parse(JSON.stringify(s)).audit.length>0)
 console.log('APP workbench checks passed: independent versions, compatibility, immutable bindings, lifecycle freeze, release conflicts, audit, field contracts and flow steps.')
} finally {rmSync(dir,{recursive:true,force:true})}
