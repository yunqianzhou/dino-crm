import { useEffect, useRef, useState } from 'react'
import { Button, Input, Radio, Space, Typography, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { Asset } from '../abPageConfig'
import { validAssetSource } from '../abPageConfig'
const { Text } = Typography
function assetDB(): Promise<IDBDatabase> { return new Promise((resolve,reject) => { const r=indexedDB.open('dino-ab-assets',1); r.onupgradeneeded=()=>r.result.createObjectStore('files'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error) }) }
export async function putAsset(id: string, file: File) { const db=await assetDB(); try { await new Promise<void>((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)}) } finally { db.close() } }
async function getAsset(id: string): Promise<Blob | undefined> { const db=await assetDB();try{return await new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()} }
export function useAssetURL(asset?: Asset) {
 const [state,setState]=useState<{src?:string;error?:string}>({})
 useEffect(()=>{ let alive=true;let url:string|undefined;setState({});if(asset?.mode!=='custom'||!asset.src)return
 if(!asset.src.startsWith('asset:')) { if(validAssetSource(asset.src))setState({src:asset.src}); return }
 getAsset(asset.src.slice(6)).then(blob=>{if(!blob)throw Error('本地素材不存在，请重新上传');url=URL.createObjectURL(blob);if(alive)setState({src:url});else URL.revokeObjectURL(url)}).catch(e=>{if(alive)setState({error:e.message})});return()=>{alive=false;if(url)URL.revokeObjectURL(url)}
 },[asset?.src,asset?.mode]);return state
}
export function AssetPreview({asset,label,className=''}:{asset?:Asset;label:string;className?:string}) {
 const {src,error}=useAssetURL(asset);const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
 if(asset?.mode==='hidden')return null
 return <div className={`ab-asset-preview ${className}`}>{asset?.mode==='custom'&&src&&!failed?<img src={src} alt={label} onError={()=>setFailed(true)} />:<span>{error||failed?'素材加载失败，App 应回退该资源位':asset?.mode==='custom'?'待添加素材':`沿用线上${label}`}</span>}</div>
}
export default function ABAssetField({label,value,onChange,disabled=false,allowGif=false,allowHide=true}:{label:string;value:Asset;onChange:(v:Asset)=>void;disabled?:boolean;allowGif?:boolean;allowHide?:boolean}) {
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const latest=useRef({onChange,disabled});latest.current={onChange,disabled};const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
 const upload=async(file:File)=>{setError('');setBusy(true);if(!latest.current.disabled)latest.current.onChange({mode:'custom',src:'',name:file.name});try{
  const b=new Uint8Array(await file.slice(0,16).arrayBuffer());const sig=String.fromCharCode(...b);const png=b[0]===137&&sig.slice(1,4)==='PNG';const jpg=b[0]===255&&b[1]===216;const gif=sig.startsWith('GIF87a')||sig.startsWith('GIF89a');const webp=sig.startsWith('RIFF')&&sig.slice(8,12)==='WEBP';
  if(!(png||jpg||webp||(allowGif&&gif)))throw Error(`请选择 PNG、JPG、WebP${allowGif?' 或 GIF':''} 文件。`)
  if(file.size>8*1024*1024)throw Error('原型单文件上限为 8 MB；正式素材规范待 UI 确认。')
  const tmp=URL.createObjectURL(file);let dimensions:{width:number;height:number};try{dimensions=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({width:im.naturalWidth,height:im.naturalHeight});im.onerror=()=>reject(Error('图片无法解码，请更换文件'));im.src=tmp})}finally{URL.revokeObjectURL(tmp)}
  const id=crypto.randomUUID();await putAsset(id,file);if(active.current&&!latest.current.disabled)latest.current.onChange({mode:'custom',src:`asset:${id}`,name:file.name,mime:gif?'image/gif':file.type,bytes:file.size,...dimensions})
 }catch(e){if(active.current)setError((e as Error).message)}finally{if(active.current)setBusy(false)}return false}
 return <div className="ab-asset-field"><div className="ab-field-label">{label}</div><Radio.Group size="small" disabled={disabled||busy} value={value.mode} onChange={e=>{setError('');onChange({...value,mode:e.target.value})}} options={[{value:'inherit',label:'沿用原素材'},{value:'custom',label:'替换素材'},...(allowHide?[{value:'hidden',label:'清空并隐藏'}]:[])]} optionType="button" />{value.mode==='custom'&&<><Space.Compact style={{width:'100%',marginTop:10}}><Input aria-label={`${label} 图片地址`} disabled={disabled||busy} value={value.src?.startsWith('asset:')?'':value.src??''} placeholder="粘贴 HTTPS 图片地址，或上传本地文件" onChange={e=>onChange({mode:'custom',src:e.target.value})}/><Upload accept={allowGif?'image/png,image/jpeg,image/webp,image/gif':'image/png,image/jpeg,image/webp'} showUploadList={false} disabled={disabled||busy} beforeUpload={upload}><Button loading={busy} disabled={disabled} icon={<UploadOutlined/>}>上传</Button></Upload></Space.Compact><AssetPreview asset={value} label={label}/>{value.name&&<Text type="secondary">{value.name} · {value.width} × {value.height} · {Math.ceil((value.bytes??0)/1024)} KB</Text>}</>}{error&&<div role="alert" className="ab-field-error">{error}</div>}</div>
}
