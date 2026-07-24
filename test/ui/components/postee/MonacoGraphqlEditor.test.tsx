import { MonacoGraphqlEditor } from "@/ui/components/postee/MonacoGraphqlEditor";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    options,
    defaultLanguage,
  }: {
    value: string;
    onChange: (value: string | undefined) => void;
    options: { readonly?: boolean };
    defaultLanguage: string;
  }) => (
    <textarea
      aria-label="GraphQL document"
      data-language={defaultLanguage}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      readOnly={options.readonly}
    />
  ),
  loader: {
    config: vi.fn(),
  },
}));

describe("MonacoGraphqlEditor", () => {
  it("keeps GraphQL syntax editing available without a schema", () => {
    const onChange = vi.fn();
    render(
      <MonacoGraphqlEditor
        value="query Systems { systems { id } }"
        onChange={onChange}
        schema={null}
        readOnly={false}
      />,
    );

    const editor = screen.getByLabelText("GraphQL document");
    expect(editor).toHaveAttribute("data-language", "postee-graphql");
    expect(editor).not.toHaveAttribute("readonly");

    fireEvent.change(editor, { target: { value: "query People { people { id } }" } });
    expect(onChange).toHaveBeenCalledWith("query People { people { id } }");
  });
});
