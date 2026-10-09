import { createContext, useContext } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { businessLineOf } from '../channel'
import { convertedPayment, convertedSummary, convertedSortValue, localCurrency, DASHBOARD_FX_VERSION, type CurrencyTargets, type DashboardCurrencyMode } from '../dashboardCurrency'
import type { Order } from '../types'
export const DashboardCurrencyContext = createContext<{mode:DashboardCurrencyMode;targets:CurrencyTargets}>({mode:'local',targets:{}})
export function useDashboardCurrency() {
 const context=useContext(DashboardCurrencyContext)
 return {...context,summary:(orders:Order[])=>convertedSummary(orders,context.mode,context.targets),sortValue:(orders:Order[],metric:'amount'|'averagePerOrder'|'averagePerUser')=>convertedSortValue(orders,context.mode,context.targets,metric)}
}
export function useDashboardCurrencyConfig() {
 const [query]=useSearchParams()
 const students=useStore(s=>s.students)
 const channels=useStore(s=>s.channels)
 return {mode:(query.get('moneyCurrency')==='USD'?'USD':'local') as DashboardCurrencyMode,targets:Object.fromEntries(students.map(s=>[s.studentId,localCurrency(businessLineOf(channels,s))]))}
}
export const currencyExportHeaders = ['Original currency','Original amount','Display currency','Conversion rate','Converted amount','Rate version']
export function currencyExportRow(order:Order, config:{mode:DashboardCurrencyMode;targets:CurrencyTargets}) {
 const value=convertedPayment(order,config.mode,config.targets)
 return [value.source,order.paidAmount,value.currency,value.rate??'Missing rate',value.amount??'Unavailable',DASHBOARD_FX_VERSION]
}
