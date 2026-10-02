const paths: Record<string, string> = {
 back: 'm15 5-7 7 7 7', close: 'm6 6 12 12M18 6 6 18', check: 'm5 12 4 4L19 6', next: 'm11 12 3 3 7-8M3 7h4M2 12h5M3 17h4',
 Food: 'M5 3v6m3-6v6M3 3v6q0 3 4 3v9M17 3v18M17 3q-5 5 0 9', Coffee: 'M4 9h12v5q0 5-6 5t-6-5ZM16 9h2a3 3 0 0 1 0 6h-2M3 21h15M8 3v3M12 2v4',
 Drink: 'M5 7h14l-2 14H7ZM13 7l2-5h4M8 12h8', Groceries: 'M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01', Transport: 'm4 9 2-5h12l2 5M3 9h18v9H3ZM5 18v3M19 18v3M6 13h2M16 13h2',
 Shopping: 'M4 7h16v14H4ZM8 7V5a4 4 0 0 1 8 0v2', Home: 'm2 11 10-9 10 9M5 9v12h14V9M10 21v-7h4v7', Travel: 'm3 10 7 2 7-9 3 1-5 10 5 4-1 2-7-3-5 5-2-1 2-6-5-3Z',
 Health: 'M12 21 3 12a5 5 0 0 1 9-7 5 5 0 0 1 9 7Z', Bills: 'M5 2h14v20l-3-2-4 2-4-2-3 2ZM8 7h8M8 11h8M8 15h5', Fun: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M7 9h.01M17 9h.01M7 14q5 6 10 0',
 Other: 'M4 12h.01M12 12h.01M20 12h.01', Gifts: 'M3 8h18v5H3ZM5 13v8h14v-8M12 8v13M12 8C2 8 6 0 12 8c6-8 10 0 0 0', Stay: 'M3 5v16M21 10v11M3 17h18M5 8h5v5H5ZM10 10h8q3 0 3 3v4',
 edit: 'm4 16 12-12 4 4L8 20H4ZM14 6l4 4', calendar: 'M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6M8 14h2M14 14h2', wallet: 'M3 5h17v16H3ZM3 5l14-3v3M15 11h6v5h-6ZM17 13h.01',
 bank: 'm2 8 10-6 10 6ZM3 21h18M5 8v10M10 8v10M14 8v10M19 8v10', cash: 'M2 5h20v14H2ZM12 8a3 3 0 1 0 0 6 3 3 0 1 0 0-6M5 9h.01M19 15h.01', split: 'M9 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6M3 20v-4q0-4 6-4t6 4v4ZM16 4a3 3 0 0 1 0 6M18 13q4 0 4 4v3', plus: 'M12 4v16M4 12h16',
}
export default function QuickIcon({ name, size = 22 }: { name: string; size?: number }) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.Other}/></svg>
}
