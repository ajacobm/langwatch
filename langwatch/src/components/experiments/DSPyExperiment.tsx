import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  HStack,
  Heading,
  Skeleton,
  Spacer,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useTheme,
} from "@chakra-ui/react";
import type { Experiment, Project, WorkflowVersion } from "@prisma/client";
import { useRouter } from "next/router";
import numeral from "numeral";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "react-feather";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DSPyRunsSummary,
  DSPyStepSummary,
} from "../../server/experiments/types";
import { api } from "../../utils/api";
import { formatMoney } from "../../utils/formatMoney";
import { formatTimeAgo } from "../../utils/formatTimeAgo";
import { getColorForString } from "../../utils/rotatingColors";
import { MetadataTag } from "../MetadataTag";
import { RenderInputOutput } from "../traces/RenderInputOutput";
import { FeedbackLink } from "../FeedbackLink";
import { VersionBox } from "../../optimization_studio/components/History";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { UseTRPCQueryResult } from "@trpc/react-query/shared";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../server/api/root";

export function DSPyExperiment({
  project,
  experiment,
}: {
  project: Project;
  experiment: Experiment;
}) {
  const {
    dspyRuns,
    selectedRuns,
    highlightedRun,
    setHighlightedRun,
    selectedPoint,
    setSelectedPoint,
    dspyRunsPlusIncoming,
    stepToDisplay,
    optimizerNames,
    labelNames,
    runsById,
  } = useDSPyExperimentState({ project, experiment });

  return (
    <HStack align="start" width="full" height="full">
      <DSPyExperimentRunList
        dspyRuns={dspyRuns}
        selectedRuns={selectedRuns}
        setHighlightedRun={setHighlightedRun}
        dspyRunsPlusIncoming={dspyRunsPlusIncoming}
      />
      <VStack
        align="start"
        width="100%"
        maxWidth="1200px"
        spacing={8}
        padding={6}
      >
        <HStack width="full" align="end">
          <Heading as="h1" size="lg">
            {experiment.name ?? experiment.slug}
          </Heading>
          <Spacer />
          <FeedbackLink />
        </HStack>
        {dspyRuns.isLoading ? (
          <Skeleton width="100%" height="30px" />
        ) : dspyRuns.error ? (
          <Alert status="error">
            <AlertIcon />
            Error loading experiment runs
          </Alert>
        ) : dspyRuns.data?.length === 0 ? (
          <Text>Waiting for the first completed step to arrive...</Text>
        ) : (
          dspyRuns.data && (
            <>
              <Card width="100%">
                <CardHeader>
                  <Heading as="h2" size="md">
                    {optimizerNames.length == 1
                      ? optimizerNames[0]!
                      : optimizerNames.length > 1
                      ? "Multiple Optimizers"
                      : "Waiting for the first completed step to arrive..."}
                  </Heading>
                </CardHeader>
                <CardBody>
                  <DSPyRunsScoresChart
                    dspyRuns={dspyRuns.data}
                    selectedPoint={selectedPoint}
                    setSelectedPoint={setSelectedPoint}
                    highlightedRun={highlightedRun}
                    selectedRuns={selectedRuns}
                    stepToDisplay={stepToDisplay}
                    labelNames={labelNames}
                  />
                </CardBody>
              </Card>
              {stepToDisplay &&
                (!highlightedRun ||
                  highlightedRun === stepToDisplay.run_id) && (
                  <Card width="100%">
                    <CardBody padding={0}>
                      <RunDetails
                        project={project}
                        experiment={experiment}
                        dspyStepSummary={stepToDisplay}
                        workflowVersion={
                          runsById?.[stepToDisplay.run_id]?.workflow_version
                        }
                      />
                    </CardBody>
                  </Card>
                )}
            </>
          )
        )}
      </VStack>
    </HStack>
  );
}

export const useDSPyExperimentState = ({
  project,
  experiment,
}: {
  project: Project;
  experiment: Experiment;
}) => {
  const dspyRuns = api.experiments.getExperimentDSPyRuns.useQuery(
    {
      projectId: project.id,
      experimentSlug: experiment.slug,
    },
    {
      refetchInterval: 3000,
      refetchOnMount: false,
    }
  );

  const router = useRouter();

  const [highlightedRun, setHighlightedRun] = useState<string | null>(null);
  const selectedRuns =
    typeof router.query.runIds === "string"
      ? router.query.runIds.split(",")
      : null;
  const [selectedPoint, setSelectedPoint] = useState<{
    runId: string;
    index: string;
  } | null>(null);

  useEffect(() => {
    if (selectedPoint && !selectedRuns?.includes(selectedPoint.runId)) {
      setSelectedPoint(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRuns]);

  const visibleRuns =
    dspyRuns.data && selectedRuns
      ? dspyRuns.data.filter((run) => selectedRuns.includes(run.runId))
      : dspyRuns.data;

  const firstVisibleRun = visibleRuns?.[0];

  useEffect(() => {
    if (!firstVisibleRun || selectedPoint !== null) return;

    const lastStep = firstVisibleRun.steps[firstVisibleRun.steps.length - 1];
    lastStep &&
      setSelectedPoint({
        runId: firstVisibleRun.runId,
        index: lastStep.index,
      });
  }, [firstVisibleRun, selectedPoint]);

  const runsById = useMemo(() => {
    return dspyRuns.data?.reduce(
      (acc, run) => {
        acc[run.runId] = run;
        return acc;
      },
      {} as Record<string, DSPyRunsSummary>
    );
  }, [dspyRuns.data]);

  const stepToDisplay =
    dspyRuns.data &&
    (selectedPoint && runsById?.[selectedPoint.runId])?.steps.find(
      (step) => step.index === selectedPoint.index
    );

  const optimizerNames = Array.from(
    new Set(
      visibleRuns?.flatMap((run) =>
        run.steps.map((step) => step.optimizer.name)
      ) ?? []
    )
  );
  const labelNames = Array.from(
    new Set(
      visibleRuns?.flatMap((run) => run.steps.map((step) => step.label)) ?? []
    )
  );

  const nonMatchingRunIds =
    selectedRuns?.filter(
      (runId) => !dspyRuns.data?.some((run) => run.runId === runId)
    ) ?? [];
  const dspyRunsPlusIncoming =
    nonMatchingRunIds.length > 0
      ? ([{ runId: nonMatchingRunIds[0] }, ...(dspyRuns.data ?? [])] as ({
          runId: string;
        } & Partial<DSPyRunsSummary>)[])
      : dspyRuns.data;

  return {
    dspyRuns,
    selectedRuns,
    highlightedRun,
    setHighlightedRun,
    dspyRunsPlusIncoming,
    stepToDisplay,
    optimizerNames,
    labelNames,
    selectedPoint,
    setSelectedPoint,
    runsById,
  };
};

export function DSPyExperimentRunList({
  dspyRuns,
  selectedRuns,
  setHighlightedRun,
  dspyRunsPlusIncoming,
  size = "md",
}: {
  dspyRuns: UseTRPCQueryResult<
    inferRouterOutputs<AppRouter>["experiments"]["getExperimentDSPyRuns"],
    TRPCClientErrorLike<AppRouter>
  >;
  selectedRuns: string[] | null;
  setHighlightedRun: (runId: string | null) => void;
  dspyRunsPlusIncoming:
    | ({
        runId: string;
      } & Partial<DSPyRunsSummary>)[]
    | undefined;
  size?: "md" | "sm";
}) {
  const router = useRouter();

  return (
    <VStack
      align="start"
      background="white"
      paddingY={size === "sm" ? 0 : 4}
      borderRightWidth="1px"
      borderColor="gray.300"
      fontSize="14px"
      minWidth={size === "sm" ? "250px" : "300px"}
      maxWidth={size === "sm" ? "250px" : "300px"}
      height="full"
      spacing={0}
      onClick={() => {
        const query = { ...router.query };
        delete query.runId;
        void router.push({ query });
      }}
    >
      {size !== "sm" && (
        <Heading as="h2" size="md" paddingX={6} paddingY={4}>
          DSPy Optimizer Runs
        </Heading>
      )}
      {dspyRuns.isLoading ? (
        <>
          {Array.from({ length: 3 }).map((_, index) => (
            <HStack key={index} paddingX={6} paddingY={2} width="100%">
              <Skeleton width="100%" height="30px" />
            </HStack>
          ))}
        </>
      ) : dspyRuns.error ? (
        <Alert status="error">
          <AlertIcon />
          Error loading experiment runs
        </Alert>
      ) : dspyRuns.data?.length === 0 ? (
        <Text paddingX={6} paddingY={4}>
          Waiting for runs...
        </Text>
      ) : (
        dspyRunsPlusIncoming?.map((run) => {
          const runCost = run.steps
            ?.map((step) => step.llm_calls_summary.total_cost)
            .reduce((acc, cost) => acc + cost, 0);
          const runName = run.workflow_version?.commitMessage ?? run.runId;

          return (
            <HStack
              key={run?.runId ?? "new"}
              paddingX={size === "sm" ? 2 : 6}
              paddingY={size === "sm" ? 2 : 4}
              width="100%"
              cursor="pointer"
              role="button"
              opacity={
                !selectedRuns || selectedRuns.includes(run.runId) ? 1 : 0.5
              }
              background={
                selectedRuns?.includes(run.runId) ? "gray.200" : "none"
              }
              _hover={{
                background: selectedRuns?.includes(run.runId)
                  ? "gray.200"
                  : "gray.100",
              }}
              onMouseEnter={() => {
                if (!selectedRuns?.includes(run.runId)) {
                  setHighlightedRun(run.runId);
                }
              }}
              onMouseLeave={() => setHighlightedRun(null)}
              onClick={(e) => {
                e.stopPropagation();
                const query: Record<string, string | undefined> = {
                  ...router.query,
                  runIds: (selectedRuns?.includes(run.runId)
                    ? selectedRuns.filter((id) => id !== run.runId)
                    : [...(selectedRuns ?? []), run.runId]
                  ).join(","),
                };
                if (!query.runIds) {
                  delete query.runIds;
                }
                void router.push({ query });
                setHighlightedRun(null);
              }}
              spacing={3}
            >
              {run.workflow_version ? (
                <VersionBox version={run.workflow_version} />
              ) : (
                <Box
                  width="24px"
                  height="24px"
                  background="gray.300"
                  borderRadius="100%"
                  backgroundColor={getColorForString("colors", run.runId).color}
                />
              )}
              <VStack align="start" spacing={0}>
                <HStack>
                  {run.workflow_version && (
                    <Box
                      width="12px"
                      height="12px"
                      background="gray.300"
                      borderRadius="100%"
                      backgroundColor={
                        getColorForString("colors", run.runId).color
                      }
                    />
                  )}
                  <Text fontSize={size === "sm" ? "13px" : "14px"}>
                    {runName}
                  </Text>
                </HStack>

                <HStack
                  color="gray.400"
                  fontSize={size === "sm" ? "12px" : "13px"}
                >
                  <Text>
                    {run.created_at
                      ? formatTimeAgo(run.created_at, "yyyy-MM-dd HH:mm", 5)
                      : "Waiting for steps..."}
                  </Text>
                  {runCost && (
                    <>
                      <Text>·</Text>
                      <Text>
                        {formatMoney(
                          { amount: runCost, currency: "USD" },
                          "$0.00[0]"
                        )}
                      </Text>
                    </>
                  )}
                </HStack>
              </VStack>
            </HStack>
          );
        })
      )}
    </VStack>
  );
}

export const RunDetails = React.memo(
  function RunDetails({
    project,
    experiment,
    dspyStepSummary,
    workflowVersion,
    size = "md",
  }: {
    project: Project;
    experiment: Experiment;
    dspyStepSummary: DSPyStepSummary;
    workflowVersion?: WorkflowVersion;
    size?: "md" | "sm";
  }) {
    const dspyStep = api.experiments.getExperimentDSPyStep.useQuery(
      {
        projectId: project.id,
        experimentSlug: experiment.slug,
        runId: dspyStepSummary?.run_id ?? "",
        index: dspyStepSummary?.index ?? "",
      },
      {
        enabled: !!dspyStepSummary,
      }
    );

    const [tabIndex, setTabIndex] = useState(0);
    const [displayRawParams, setDisplayRawParams] = useState(false);
    const hasTrace = dspyStep.data?.examples.some((example) => example.trace);
    const runName = workflowVersion?.commitMessage ?? dspyStepSummary.run_id;

    return (
      <VStack width="100%" spacing={0}>
        {size !== "sm" && (
          <HStack width="100%" spacing={8} padding={4}>
            <HStack spacing={3}>
              {workflowVersion ? (
                <>
                  <VersionBox version={workflowVersion} />
                  <Box
                    width="18px"
                    height="18px"
                    background="gray.300"
                    borderRadius="100%"
                    backgroundColor={
                      getColorForString("colors", dspyStepSummary.run_id).color
                    }
                  />
                </>
              ) : (
                <Box
                  width="24px"
                  height="24px"
                  borderRadius="100%"
                  background={
                    getColorForString("colors", dspyStepSummary.run_id).color
                  }
                />
              )}
              <Heading as="h2" size="md" marginTop="-1px">
                {runName} (step {dspyStepSummary.index})
              </Heading>
            </HStack>
            <Spacer />
            <HStack>
              <MetadataTag
                label="Step Cost"
                value={formatMoney(
                  {
                    amount: dspyStepSummary.llm_calls_summary.total_cost,
                    currency: "USD",
                  },
                  "$0.00[00]"
                )}
              />
              <MetadataTag
                label="Step Tokens"
                value={numeral(
                  dspyStepSummary.llm_calls_summary.total_tokens
                ).format("0a")}
              />
              <MetadataTag
                label={dspyStepSummary.label}
                value={numeral(dspyStepSummary.score).format("0.[00]")}
              />
            </HStack>
          </HStack>
        )}
        <Tabs index={tabIndex} onChange={setTabIndex} size={size} width="100%">
          <TabList position="relative">
            {tabIndex === 0 && size !== "sm" && (
              <Box position="absolute" top={0} right={4}>
                <HStack>
                  <Text fontSize={size === "sm" ? "13px" : "14px"}>Raw</Text>
                  <Switch
                    isChecked={displayRawParams}
                    onChange={() => setDisplayRawParams(!displayRawParams)}
                  />
                </HStack>
              </Box>
            )}
            <Tab>
              Predictors{" "}
              {dspyStep.data && `(${dspyStep.data.predictors.length})`}
            </Tab>
            <Tab>
              Evaluations{" "}
              {dspyStep.data && `(${dspyStep.data.examples.length})`}
            </Tab>
            <Tab>
              LLM Calls {dspyStep.data && `(${dspyStep.data.llm_calls.length})`}
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel
              padding={0}
              paddingTop={displayRawParams ? 4 : 0}
              maxHeight="calc(100vh - 160px)"
              overflowY="auto"
            >
              {dspyStep.isLoading ? (
                <Skeleton width="100%" height="30px" />
              ) : dspyStep.error ? (
                <Alert status="error">
                  <AlertIcon />
                  Error loading step data
                </Alert>
              ) : dspyStep.data && displayRawParams ? (
                <RenderInputOutput
                  value={JSON.stringify(dspyStep.data?.predictors)}
                  collapseStringsAfterLength={140}
                />
              ) : dspyStep.data ? (
                <Table size={size === "sm" ? "xs" : "sm"} variant="grid">
                  <Thead>
                    <Tr>
                      <Th minWidth="15px" maxWidth="15px" paddingY={3}></Th>
                      <Th width="10%" paddingY={3}>
                        Name
                      </Th>
                      <Th width="25%" paddingY={3}>
                        Instructions
                      </Th>
                      <Th width="25%" paddingY={3}>
                        Signature
                      </Th>
                      <Th width="40%" paddingY={3}>
                        Demonstrations
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {dspyStep.isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <Tr key={index}>
                          <Td background="gray.50">&nbsp;</Td>
                          <Td>
                            <Skeleton width="100%" height="30px" />
                          </Td>
                          <Td>
                            <Skeleton width="100%" height="30px" />
                          </Td>
                          <Td>
                            <Skeleton width="100%" height="30px" />
                          </Td>
                          <Td>
                            <Skeleton width="100%" height="30px" />
                          </Td>
                        </Tr>
                      ))
                    ) : dspyStep.error ? (
                      <Tr>
                        <Td colSpan={5} color="red.600">
                          Error loading step data
                        </Td>
                      </Tr>
                    ) : dspyStep.data.predictors.length === 0 ? (
                      <Tr>
                        <Td colSpan={5}>No entries</Td>
                      </Tr>
                    ) : dspyStep.data ? (
                      dspyStep.data.predictors.map(
                        ({ name, predictor }, index) => {
                          const signature =
                            predictor?.extended_signature ??
                            predictor?.signature;
                          return (
                            <Tr key={index}>
                              <Td background="gray.50" textAlign="center">
                                {index + 1}
                              </Td>
                              <Td>{name}</Td>
                              <Td whiteSpace="pre-wrap">
                                {signature?.instructions ?? "-"}
                              </Td>
                              <Td>
                                <CollapsableSignature signature={signature} />
                              </Td>
                              <Td>
                                {predictor?.demos ? (
                                  <RenderInputOutput
                                    value={JSON.stringify(
                                      predictor.demos.map((demo: any) =>
                                        demo._store ? demo._store : demo
                                      )
                                    )}
                                    collapseStringsAfterLength={140}
                                    shouldCollapse={(field) => {
                                      return field.type === "array";
                                    }}
                                  />
                                ) : (
                                  "-"
                                )}
                              </Td>
                            </Tr>
                          );
                        }
                      )
                    ) : null}
                  </Tbody>
                </Table>
              ) : null}
            </TabPanel>
            <TabPanel
              padding={0}
              maxHeight="calc(100vh - 160px)"
              overflowY="auto"
            >
              {tabIndex === 1 && (
                <Table size={size === "sm" ? "xs" : "sm"} variant="grid">
                  <Thead>
                    <Tr>
                      <Th minWidth="15px" maxWidth="15px" paddingY={3}></Th>
                      <Th width="30%" paddingY={3}>
                        Example
                      </Th>
                      <Th width="50%" paddingY={3}>
                        Prediction
                      </Th>
                      <Th width="20%" paddingY={3}>
                        Score
                      </Th>
                      {hasTrace && (
                        <Th minWidth="200px" paddingY={3}>
                          Trace
                        </Th>
                      )}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {dspyStep.isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <Tr key={index}>
                          <Td background="gray.50">&nbsp;</Td>
                          <Td>
                            <Skeleton width="100%" height="30px" />
                          </Td>
                          <Td>
                            <Skeleton width="100%" height="30px" />
                          </Td>
                          <Td>
                            <Skeleton width="100%" height="30px" />
                          </Td>
                        </Tr>
                      ))
                    ) : dspyStep.error ? (
                      <Tr>
                        <Td colSpan={4} color="red.600">
                          Error loading step data
                        </Td>
                      </Tr>
                    ) : dspyStep.data.examples.length === 0 ? (
                      <Tr>
                        <Td colSpan={4}>No entries</Td>
                      </Tr>
                    ) : dspyStep.data ? (
                      dspyStep.data.examples.map((example, index) => (
                        <Tr key={index}>
                          <Td background="gray.50" textAlign="center">
                            {index + 1}
                          </Td>
                          <Td>
                            <RenderInputOutput
                              value={JSON.stringify(example.example)}
                              collapseStringsAfterLength={140}
                            />
                          </Td>
                          <Td>
                            <RenderInputOutput
                              value={JSON.stringify(example.pred)}
                              collapseStringsAfterLength={140}
                            />
                          </Td>
                          <Td>{example.score}</Td>
                          {hasTrace && (
                            <Td>
                              <RenderInputOutput
                                value={JSON.stringify(example.trace)}
                                collapseStringsAfterLength={140}
                                collapsed={true}
                              />
                            </Td>
                          )}
                        </Tr>
                      ))
                    ) : null}
                  </Tbody>
                </Table>
              )}
            </TabPanel>
            <TabPanel
              padding={0}
              maxHeight="calc(100vh - 160px)"
              overflowY="auto"
            >
              <Table size={size === "sm" ? "xs" : "sm"} variant="grid">
                <Thead>
                  <Tr>
                    <Th minWidth="15px" maxWidth="15px" paddingY={3}></Th>
                    <Th width="20%" paddingY={3}>
                      Model
                    </Th>
                    <Th width="35%" paddingY={3}>
                      Response
                    </Th>
                    <Th width="15%" paddingY={3}>
                      Prompt Tokens
                    </Th>
                    <Th width="15%" paddingY={3}>
                      Completion Tokens
                    </Th>
                    <Th width="15%" paddingY={3}>
                      Cost
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dspyStep.isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <Tr key={index}>
                        <Td background="gray.50">&nbsp;</Td>
                        <Td>
                          <Skeleton width="100%" height="30px" />
                        </Td>
                        <Td>
                          <Skeleton width="100%" height="30px" />
                        </Td>
                        <Td>
                          <Skeleton width="100%" height="30px" />
                        </Td>
                        <Td>
                          <Skeleton width="100%" height="30px" />
                        </Td>
                        <Td>
                          <Skeleton width="100%" height="30px" />
                        </Td>
                      </Tr>
                    ))
                  ) : dspyStep.error ? (
                    <Tr>
                      <Td colSpan={6} color="red.600">
                        Error loading step data
                      </Td>
                    </Tr>
                  ) : dspyStep.data.llm_calls.length === 0 ? (
                    <Tr>
                      <Td colSpan={6}>No entries</Td>
                    </Tr>
                  ) : dspyStep.data ? (
                    dspyStep.data.llm_calls.map((llmCall, index) => {
                      const response =
                        llmCall.response?.choices?.[0]?.message?.content;
                      return (
                        <Tr key={index}>
                          <Td background="gray.50" textAlign="center">
                            {index + 1}
                          </Td>
                          <Td>{llmCall.model}</Td>
                          <Td>
                            {response ? (
                              response
                            ) : (
                              <RenderInputOutput
                                value={JSON.stringify(llmCall.response)}
                                collapseStringsAfterLength={140}
                                collapsed={true}
                              />
                            )}
                          </Td>
                          <Td>{llmCall.prompt_tokens}</Td>
                          <Td>{llmCall.completion_tokens}</Td>
                          <Td>
                            {llmCall.cost
                              ? formatMoney(
                                  { amount: llmCall.cost, currency: "USD" },
                                  "$0.00[0000]"
                                )
                              : "-"}
                          </Td>
                        </Tr>
                      );
                    })
                  ) : null}
                </Tbody>
              </Table>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.project.id === nextProps.project.id &&
      prevProps.experiment.slug === nextProps.experiment.slug &&
      prevProps.dspyStepSummary?.run_id === nextProps.dspyStepSummary?.run_id &&
      prevProps.dspyStepSummary?.index === nextProps.dspyStepSummary?.index
    );
  }
);

function CollapsableSignature({
  signature,
}: {
  signature: Record<string, any> | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <VStack>
      <HStack>
        <Button
          size="sm"
          fontSize="14px"
          fontWeight="normal"
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
          rightIcon={
            isOpen ? <ChevronUp width="12px" /> : <ChevronDown width="12px" />
          }
        >
          {signature?.signature ?? "-"}
        </Button>
      </HStack>
      {isOpen && signature?.fields ? (
        <RenderInputOutput
          value={JSON.stringify(signature.fields)}
          collapseStringsAfterLength={140}
          collapsed={false}
        />
      ) : null}
    </VStack>
  );
}

export function DSPyRunsScoresChart({
  dspyRuns,
  selectedPoint,
  setSelectedPoint,
  highlightedRun,
  selectedRuns,
  stepToDisplay,
  labelNames,
}: {
  dspyRuns: DSPyRunsSummary[];
  selectedPoint: { runId: string; index: string } | null;
  setSelectedPoint: (value: { runId: string; index: string } | null) => void;
  highlightedRun: string | null;
  selectedRuns: string[] | null;
  stepToDisplay: DSPyStepSummary | undefined;
  labelNames: string[];
}) {
  const runIsVisible = (runId: string) =>
    (!selectedRuns && !highlightedRun) ||
    (!!highlightedRun && highlightedRun === runId) ||
    (!highlightedRun && !!selectedRuns && selectedRuns.includes(runId));

  const stepsFlattenedByIndex = dspyRuns.reduce(
    (acc, run) => {
      if (!runIsVisible(run.runId)) return acc;
      run.steps.forEach((step) => {
        acc[step.index] = {
          ...(acc[step.index] ?? {}),
          index: step.index,
          [run.runId]: step.score,
          [`${run.runId}_label`]: step.label,
          [`${run.runId}_version`]: run.workflow_version?.version,
        } as { index: string } & Record<string, number>;
      });
      return acc;
    },
    {} as Record<string, { index: string } & Record<string, number>>
  );

  const data = Object.values(stepsFlattenedByIndex).sort((a, b) => {
    const aParts = a.index.split(".").map(Number);
    const bParts = b.index.split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      const aPart = aParts[i] ?? 0;
      const bPart = bParts[i] ?? 0;
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }

    return 0;
  });

  const theme = useTheme();
  const getColor = (runId: string) => {
    const [name, number] = getColorForString("colors", runId).color.split(".");
    if (!name || !number) {
      return theme.colors.gray[300];
    }
    return theme.colors[name][number];
  };

  const [hoveredRunIndex, setHoveredRunIndex] = useState<{
    runId: string;
    index: string;
  } | null>(null);

  return (
    <Box width="100%" position="relative">
      {data.length === 0 && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
        >
          No data
        </Box>
      )}
      <ResponsiveContainer height={300}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 15 }}
          style={{
            cursor: hoveredRunIndex ? "pointer" : "default",
          }}
          onClick={() => {
            if (
              hoveredRunIndex &&
              (hoveredRunIndex.runId !== selectedPoint?.runId ||
                hoveredRunIndex.index !== selectedPoint?.index)
            ) {
              setSelectedPoint(hoveredRunIndex);
            } else {
              setSelectedPoint(null);
            }
          }}
          onMouseMove={(state) => {
            if (state.isTooltipActive) {
              const runId = state.activePayload?.[0]?.name;
              const index = state.activeLabel;
              if (runId && index !== undefined) {
                setHoveredRunIndex({
                  runId,
                  index,
                });
              } else {
                setHoveredRunIndex(null);
              }
            } else {
              setHoveredRunIndex(null);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="index"
            name="Step"
            label={{
              value: "Step",
              position: "insideBottomRight",
              offset: -10,
            }}
          />
          <YAxis
            type="number"
            name={labelNames.length == 1 ? labelNames[0] : "Score"}
            label={{
              value: labelNames.length == 1 ? labelNames[0] : "Score",
              angle: -90,
              position: "insideLeft",
              offset: -5,
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip
            labelFormatter={(value) => `Step ${value}`}
            formatter={(value, name, props) => {
              const label = props.payload[`${name}_label`];
              const version = props.payload[`${name}_version`];
              return [
                numeral(value).format("0.[00]"),
                [version ? `[${version}]` : name, label]
                  .filter((x) => x)
                  .join(" "),
              ];
            }}
          />
          {dspyRuns.map(({ runId }) =>
            runIsVisible(runId) ? (
              <Line
                key={runId}
                type="monotone"
                dataKey={runId}
                stroke={getColor(runId)}
                name={runId}
                dot={{
                  r: 5,
                  fill: getColor(runId),
                }}
                isAnimationActive={false}
              />
            ) : null
          )}
          {stepToDisplay &&
            (!highlightedRun || highlightedRun === stepToDisplay.run_id) && (
              <ReferenceDot
                x={stepToDisplay.index}
                y={
                  stepsFlattenedByIndex[stepToDisplay.index]?.[
                    stepToDisplay.run_id
                  ]
                }
                stroke={getColor(stepToDisplay.run_id)}
                fill={getColor(stepToDisplay.run_id)}
              />
            )}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
