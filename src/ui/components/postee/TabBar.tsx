/**
 * TabBar - Tab navigation component
 *
 * Used to switch between Body, Headers, Query Params sections
 * Built with React Aria for accessibility
 */

import { Tabs, TabList, Tab } from "react-aria-components";
import { tabBar, tab, tabActive } from "./TabBar.css";

interface TabBarProps {
	tabs: Array<string | { id: string; label: string }>;
	activeTab: string;
	onTabChange: (tab: string) => void;
	children: React.ReactNode;
}

export function TabBar({ tabs, activeTab, onTabChange, children }: TabBarProps) {
	const tabItems = tabs.map((item) =>
		typeof item === "string" ? { id: item, label: item } : item,
	);

	return (
		<Tabs selectedKey={activeTab} onSelectionChange={(key) => onTabChange(key as string)}>
			<TabList className={tabBar}>
				{tabItems.map((tabItem) => (
					<Tab
						key={tabItem.id}
						id={tabItem.id}
						className={({ isSelected }) =>
							isSelected ? `${tab} ${tabActive}` : tab
						}
					>
						{tabItem.label}
					</Tab>
				))}
			</TabList>
			{children}
		</Tabs>
	);
}
