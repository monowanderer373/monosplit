const paths:Record<string,string>={
 back:'m15 18-6-6 6-6',chevron:'m9 18 6-6-6-6',user:'M4 21v-2a8 8 0 0 1 16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',
 shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4',file:'M6 2h9l5 5v15H6ZM15 2v5h5M9 12h8M9 16h8',
 chat:'M20 11a8 8 0 0 1-8 8H5l-2 3v-7A8 8 0 1 1 20 11ZM8 11h.01M12 11h.01M16 11h.01',
 reset:'M3 12a9 9 0 1 0 3-7M3 3v6h6',logout:'M10 4H4v16h6M15 8l5 4-5 4M20 12H8',archive:'M3 3h18v5H3ZM5 8v13h14V8M9 12h6',
 wallet:'M3 5h17v16H3ZM3 5l14-3v3M15 11h6v5h-6',mail:'M2 4h20v16H2Zm1 2 9 7 9-7',lock:'M5 10h14v12H5ZM8 10V6a4 4 0 0 1 8 0v4',
 bug:'M8 8h8v9a4 4 0 0 1-8 0ZM9 8V6a3 3 0 0 1 6 0v2M4 10h4M16 10h4M4 15h4M16 15h4M4 20l4-3M16 17l4 3',
 idea:'M9 18v-3a6 6 0 1 1 6 0v3M9 18h6M10 22h4',check:'m5 12 4 4L19 6',camera:'M3 7h4l2-2h6l2 2h4v13H3ZM15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 export:'M12 16V3m-5 5 5-5 5 5M3 14v7h18v-7',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',book:'M12 5v16M3 3q5-1 9 2 4-3 9-2v16q-5-1-9 2-4-3-9-2Z',
}
export default function MeIcon({name,size=22}:{name:string;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.file}/></svg>}
