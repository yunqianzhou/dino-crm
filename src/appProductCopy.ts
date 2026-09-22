import type { Plan } from './abTestConfig'
const english:Record<string,string>={
 '让孩子自信开口说英语':'Help your child speak English with confidence','和 Dino 一起，在有趣的互动中开启英语学习之旅。':'Start a fun English learning journey with Dino.','我是新用户':'Get started','已有账号？':'Already have an account?','登录':'Log in',
 '开启孩子的英语成长之旅':'Start your child’s English journey','每一次开口，都是成长的一小步。':'Every conversation is a step forward.','继续注册 / 登录':'Log in or sign up','陪伴孩子的英语成长':'Grow with English',
 '我们该怎么称呼你？':'What should we call you?','告诉 Dino 你的名字，让我们成为朋友吧。':'Tell Dino your name.','继续':'Continue','孩子的名字或昵称':'Your child’s name or nickname','嗨，我是 Dino！回答几个小问题，找到适合你的起点。':'Hi, I’m Dino! Let’s find your starting point.',
 '孩子今年几岁？':'How old is your child?','我们会推荐适合孩子年龄的学习内容。':'We’ll find learning content for your child.',
 '孩子的英语水平怎么样？':'How much English does your child know?','选择最符合当前情况的一项。':'Choose the option that fits best.','刚起步，认识 hello 和 bye':'Just starting: hello and bye','认识常见单词，还不会组成句子':'Knows words, not sentences yet','能读简单句子、做简短回答':'Can read simple sentences and reply','能独立读故事、谈论经历':'Can read stories and talk about experiences',
 '你希望孩子收获什么？':'What are your child’s learning goals?','让每一次练习，都更接近学习目标。':'Make every practice count.','自信开口说英语':'Speak English confidently','提升校内英语表现':'Do better at school','打好英语基础':'Build a strong foundation','在生活中使用英语':'Use English in daily life','养成持续学习习惯':'Build a learning habit',
 'Dino 为你准备了专属优惠':'A special offer just for you','你的优惠码已解锁特别价格。':'Your promo code unlocked a special price.','领取专属优惠':'Claim offer','让孩子的进步继续发生':'Keep your child growing','选择适合孩子的学习计划。':'Choose the right plan for your child.','立即订阅':'Subscribe now','专属优惠已解锁':'Exclusive offer unlocked','给你的一份特别优惠':'A special offer for you','优惠即将结束':'Offer ends soon',
 '给孩子更多开口的机会':'More chances to speak English','开启专属英语学习旅程，让进步每天发生。':'Start a personal English journey.','开启学习之旅':'Start learning','陪伴孩子成长':'Help your child grow','开启英语学习旅程':'Start learning English','学习权益':'Learning benefits','限时优惠':'Limited offer','每周 AI 课程':'Weekly AI lessons','学习进度':'Learning progress','课后学习报告':'Learning reports',
}
export function englishDefaults(plan:Plan,node:string):Plan{
 const p=plan;p.baseLanguage='en';const d=p.pages?.[node];if(!d)return p;
 const convert=(v:string)=>english[v]??v;
 if(p.copy[node]){p.translations.zh={...p.translations.zh,[node]:{...p.copy[node]}};p.copy[node]={...p.copy[node],title:convert(p.copy[node].title),body:convert(p.copy[node].body),button:convert(p.copy[node].button)}}
 const zh:Record<string,string>={};for(const [k,v]of Object.entries(d.texts)){zh[k]=v;d.texts[k]=convert(v)}
 for(const [k,rows]of Object.entries(d.lists))for(const row of rows){zh[`${k}.${row.id}.label`]=row.label;row.label=convert(row.label);if(row.body!==undefined){zh[`${k}.${row.id}.body`]=row.body;row.body=convert(row.body)}}
 p.pageTranslations={...p.pageTranslations,zh:{...p.pageTranslations?.zh,[node]:zh}};return p
}
export const productLanguages=[{value:'en',label:'English（基础文案）'},{value:'zh',label:'简体中文'},{value:'ar',label:'العربية'},{value:'ko',label:'한국어'},{value:'vi',label:'Tiếng Việt'},{value:'ms',label:'Bahasa Melayu'}]
