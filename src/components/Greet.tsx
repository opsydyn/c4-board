import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { greetInput } from "../styles/index.css.ts";

export function Greet() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    const result = await invoke<string>("greet", { name });
    setGreetMsg(result);
  }

  return (
    <>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          className={greetInput}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>

      <p className="row">{greetMsg}</p>
    </>
  );
}
