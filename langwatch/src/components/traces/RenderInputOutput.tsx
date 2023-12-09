import { Text } from "@chakra-ui/react";
import dynamic from "next/dynamic";

export function RenderInputOutput({ value }: { value: string | undefined; }) {
  const ReactJson = dynamic(() => import("@microlink/react-json-view"), {
    loading: () => <div />,
  });

  let json: object | undefined;
  try {
    if (value) {
      json = JSON.parse(value);
    }
  } catch (e) { }

  return typeof document !== "undefined" && json ? (
    <ReactJson
      src={json}
      name={false}
      displayDataTypes={false}
      displayObjectSize={false}
      enableClipboard={false}
      //@ts-ignore
      displayArrayKey={false} />
  ) : (
    <Text>{value ?? ""}</Text>
  );
}
