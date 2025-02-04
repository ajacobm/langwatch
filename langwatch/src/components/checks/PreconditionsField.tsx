import {
  Box,
  Button,
  HStack,
  Input,
  Select,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import type {
  CheckPrecondition,
  CheckPreconditionFields,
} from "../../server/evaluations/types";
import { HorizontalFormControl } from "../HorizontalFormControl";
import { HelpCircle, X } from "react-feather";
import { SmallLabel } from "../SmallLabel";
import { getEvaluatorDefinitions } from "../../server/evaluations/getEvaluator";
import { useEffect } from "react";

const ruleOptions: Record<CheckPrecondition["rule"], string> = {
  not_contains: "does not contain",
  contains: "contains",
  is_similar_to: "is similar to",
  matches_regex: "matches regex",
};

const fieldOptions: Record<CheckPreconditionFields, string> = {
  output: "output",
  input: "input",
  "metadata.labels": "metadata.labels",
};

export const PreconditionsField = ({
  runOn,
  append,
  remove,
  fields,
}: {
  runOn: JSX.Element | null;
  append: (value: any) => void;
  remove: (index: number) => void;
  fields: Record<"id", string>[];
}) => {
  const { control, watch, setValue } = useFormContext();
  const preconditions = watch("preconditions");
  const checkType = watch("checkType");

  const evaluator = getEvaluatorDefinitions(checkType);

  useEffect(() => {
    for (const precondition of preconditions) {
      if (
        precondition.rule === "is_similar_to" &&
        !["input", "output"].includes(precondition.field)
      ) {
        setValue(
          `preconditions.${preconditions.indexOf(precondition)}.rule`,
          "contains"
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(preconditions), setValue]); // has to stringify otherwise it will not trigger

  return (
    <HorizontalFormControl
      label="Preconditions"
      helper="Conditions that must be met for this check to run"
    >
      <VStack align="start" spacing={4}>
        {evaluator?.requiredFields.includes("contexts") && (
          <Box borderLeft="4px solid" borderLeftColor="blue.400" width="full">
            <VStack
              borderLeftColor="reset"
              padding={3}
              width="full"
              align="start"
              position="relative"
            >
              <Text>Requires RAG Contexts</Text>
              <Text color="gray.500" fontStyle="italic">
                This evaluator will only run if the RAG contexts are provided
              </Text>
            </VStack>
          </Box>
        )}
        {evaluator?.requiredFields.includes("expected_output") && (
          <Box borderLeft="4px solid" borderLeftColor="blue.400" width="full">
            <VStack
              borderLeftColor="reset"
              padding={3}
              width="full"
              align="start"
              position="relative"
            >
              <Text>Requires an Expected Output</Text>
              <Text color="gray.500" fontStyle="italic">
                This evaluator will only run if the expected output is provided
              </Text>
            </VStack>
          </Box>
        )}
        {evaluator?.requiredFields.includes("expected_contexts") && (
          <Box borderLeft="4px solid" borderLeftColor="blue.400" width="full">
            <VStack
              borderLeftColor="reset"
              padding={3}
              width="full"
              align="start"
              position="relative"
            >
              <Text>Requires Expected Contexts</Text>
              <Text color="gray.500" fontStyle="italic">
                This evaluator will only run if the expected contexts are
                provided
              </Text>
            </VStack>
          </Box>
        )}
        {fields.map((field, index) => (
          <Box
            key={field.id}
            borderLeft="4px solid"
            borderLeftColor="blue.400"
            width="full"
          >
            <VStack
              borderLeftColor="reset"
              padding={3}
              width="full"
              align="start"
              position="relative"
            >
              <Button
                position="absolute"
                right={0}
                top={0}
                padding={0}
                size="sm"
                variant="ghost"
                onClick={() => remove(index)}
                color="gray.400"
              >
                <X />
              </Button>
              <SmallLabel>{index == 0 ? "When" : "and"}</SmallLabel>
              <HStack spacing={4}>
                <Select
                  {...control.register(`preconditions.${index}.field`)}
                  minWidth="fit-content"
                >
                  {Object.entries(fieldOptions).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Select
                  {...control.register(`preconditions.${index}.rule`)}
                  minWidth="fit-content"
                >
                  {Object.entries(ruleOptions)
                    .filter(
                      ([value, _]) =>
                        value !== "is_similar_to" ||
                        ["input", "output"].includes(preconditions[index].field)
                    )
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </Select>
              </HStack>
              <HStack width="full">
                {preconditions[index]?.rule.includes("regex") && (
                  <Text fontSize={16}>{"/"}</Text>
                )}
                <Input
                  {...control.register(`preconditions.${index}.value`)}
                  placeholder={
                    preconditions[index]?.rule.includes("regex")
                      ? "regex"
                      : "text"
                  }
                />
                {preconditions[index]?.rule.includes("regex") && (
                  <Text fontSize={16}>{"/gi"}</Text>
                )}
              </HStack>
              {preconditions[index]?.rule === "is_similar_to" && (
                <>
                  <HStack>
                    <SmallLabel>With semantic similarity above </SmallLabel>
                    <Tooltip
                      label={`this is how similar the ${preconditions[index].field} must be to the provided text for the check to be evaluated, scored from 0.0 to 1.0. Similarity between the two texts is calculated by the cosine similarity of their semantic vectors`}
                    >
                      <HelpCircle width="14px" />
                    </Tooltip>
                  </HStack>
                  <Controller
                    control={control}
                    name={`preconditions.${index}.threshold`}
                    defaultValue={0.7}
                    render={({ field }) => (
                      <Input
                        width="110px"
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        placeholder="0.0"
                        {...field}
                        onChange={(e) => field.onChange(+e.target.value)}
                      />
                    )}
                  />
                </>
              )}
            </VStack>
          </Box>
        ))}
        {runOn}
        <Button
          onClick={() =>
            append({
              field: "output",
              rule: "contains",
              value: "",
              threshold: 0.85,
            })
          }
        >
          Add Precondition
        </Button>
      </VStack>
    </HorizontalFormControl>
  );
};
