import type {ReactNode} from 'react'
import MeIcon from './MeIcon'
export function MeRow({title,sub,icon,value,onClick,disabled=false,later,destructive=false}:{title:string;sub?:string;icon:string;value?:string;onClick?:()=>void;disabled?:boolean;later?:string;destructive?:boolean}){
 return <button type="button" className={`me-row${destructive?' me-destructive':''}`} disabled={disabled} onClick={onClick}><span className="me-icon"><MeIcon name={icon}/></span><span className="me-grow"><span className="me-row-title">{title}</span>{sub?<span className="me-row-sub">{sub}</span>:null}</span>{value?<span className="me-value">{value}</span>:null}{later?<span className="me-later">{later}</span>:onClick?<MeIcon name="chevron" size={18}/>:null}</button>
}
export function MeSection({title,children}:{title:string;children:ReactNode}){return <section className="me-section"><h2 className="me-section-title"><span>{title}</span></h2>{children}</section>}
export function MePaper({children}:{children:ReactNode}){return <section className="me-paper">{children}</section>}
export function MeNote({children,warning=false}:{children:ReactNode;warning?:boolean}){return <p className={`me-note${warning?' me-warning':''}`}>{children}</p>}
