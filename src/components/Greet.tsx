import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { greetInput } from "../styles/index.css.ts";

export function Greet() {
	const [greetMsg, setGreetMsg] = createSignal("");
	const [name, setName] = createSignal("");

	async function greet() {
		// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
		return setGreetMsg(await invoke("greet", { name: name() }));
	}

	return (
		<>
			<form
				class="row"
				onSubmit={(e) => {
					e.preventDefault();
					greet();
				}}
			>
				<input
					id="greet-input"
					class={greetInput}
					onChange={(e) => setName(e.currentTarget.value)}
					placeholder="Enter a name..."
				/>
				<button type="submit">Greet</button>
			</form>

			<p class="row">{greetMsg()}</p>
		</>
	);
}
