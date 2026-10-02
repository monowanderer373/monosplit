export type QuickCategory = { name: string; icon: string; zh?: string }
export const QUICK_CATEGORIES: QuickCategory[] = [
 {name:'Food',icon:'Food',zh:'餐饮'}, {name:'Coffee',icon:'Coffee',zh:'咖啡'}, {name:'Drink',icon:'Drink',zh:'饮品'},
 {name:'Groceries',icon:'Groceries',zh:'杂货'}, {name:'Transport',icon:'Transport',zh:'交通'}, {name:'Shopping',icon:'Shopping',zh:'购物'},
 {name:'Home',icon:'Home',zh:'居家'}, {name:'Travel',icon:'Travel',zh:'旅行'}, {name:'Health',icon:'Health',zh:'健康'},
 {name:'Bills',icon:'Bills',zh:'账单'}, {name:'Fun',icon:'Fun',zh:'娱乐'}, {name:'Other',icon:'Other',zh:'其他'},
 {name:'Gifts',icon:'Gifts',zh:'礼物'}, {name:'Stay',icon:'Stay',zh:'住宿'}, {name:'Fruit',icon:'Food',zh:'水果'},
 {name:'Dessert',icon:'Food',zh:'甜点'}, {name:'Noodle',icon:'Food',zh:'面食'}, {name:'Greens',icon:'Groceries',zh:'蔬菜'},
 {name:'Car',icon:'Transport',zh:'汽车'}, {name:'Bus',icon:'Transport',zh:'巴士'}, {name:'Plane',icon:'Travel',zh:'飞机'},
 {name:'Clothes',icon:'Shopping',zh:'服装'}, {name:'Sport',icon:'Fun',zh:'运动'}, {name:'Game',icon:'Fun',zh:'游戏'},
]
export function readQuickCategories(identity: string): QuickCategory[] {
 try { const rows=JSON.parse(localStorage.getItem(`tt-categories:${identity}`)||'null');
   if(Array.isArray(rows)&&rows.length&&rows.length<=100&&rows.every(r=>typeof r.name==='string'&&r.name.trim()&&r.name.length<=100&&typeof r.icon==='string')&&new Set(rows.map(r=>r.name)).size===rows.length) return rows
 } catch { /* use defaults */ }
 return QUICK_CATEGORIES
}
