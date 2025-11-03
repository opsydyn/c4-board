/**
 * TabBar - Tab navigation component
 *
 * Used to switch between Body, Headers, Query Params sections
 * Built with React Aria for accessibility
 */

import { Tabs, TabList, Tab } from "react-aria-components";
import { tabBar, tab, tabActive } from "./TabBar.css";

interface TabBarProps {
	tabs: string[];
	activeTab: string;
	onTabChange: (tab: string) => void;
	children: React.ReactNode;
}

export function TabBar({ tabs, activeTab, onTabChange, children }: TabBarProps) {
	return (
		<Tabs selectedKey={activeTab} onSelectionChange={(key) => onTabChange(key as string)}>
			<TabList className={tabBar}>
				{tabs.map((tabName) => (
					<Tab
						key={tabName}
						id={tabName}
						className={({ isSelected }) =>
							isSelected ? `${tab} ${tabActive}` : tab
						}
					>
						{tabName}
					</Tab>
				))}
			</TabList>
			{children}
		</Tabs>
	);
}
