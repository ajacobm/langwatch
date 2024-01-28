import { type Worker, type Job } from "bullmq";
import { getCheckExecutor } from "../../trace_checks/backend";
import type {
  CheckTypes,
  TopicClusteringJob,
  TraceCheckJob,
  TraceCheckResult,
} from "../../trace_checks/types";
import { getDebugger } from "../../utils/logger";
import { esGetSpansByTraceId, esGetTraceById } from "../api/routers/traces";
import { prisma } from "../db";
import { startTopicClusteringWorker } from "./workers/topicClusteringWorker";
import { startTraceChecksWorker } from "./workers/traceChecksWorker";

const debug = getDebugger("langwatch:workers");

// TODO: allow processing in batch
export const process = async (
  job: Job<TraceCheckJob, any, string>
): Promise<TraceCheckResult> => {
  const trace = await esGetTraceById(job.data.trace.id);
  const spans = await esGetSpansByTraceId(job.data.trace.id);
  if (!trace) {
    throw "trace not found";
  }

  const check = await prisma.check.findUnique({
    where: { id: job.data.check.id },
  });
  if (!check) {
    throw `check config ${job.data.check.id} not found`;
  }

  const checkExecutor = getCheckExecutor(check.checkType);
  if (!checkExecutor) {
    throw `trace executor not found for ${check.checkType}`;
  }

  return await checkExecutor(trace, spans, (check.parameters ?? {}) as any);
};

export const start = (
  processMock:
    | ((job: Job<TraceCheckJob, any, CheckTypes>) => Promise<TraceCheckResult>)
    | undefined = undefined,
  maxRuntimeMs: number | undefined = undefined
): Promise<
  | {
      traceChecksWorker: Worker<TraceCheckJob, any, CheckTypes>;
      topicClusteringWorker: Worker<TopicClusteringJob, void, string>;
    }
  | undefined
> => {
  return new Promise((resolve) => {
    const processFn = processMock ?? process;

    const traceChecksWorker = startTraceChecksWorker(processFn);
    debug("Trace checks worker registered");

    const topicClusteringWorker = startTopicClusteringWorker();
    debug("Topic clustering checks worker registered");

    if (maxRuntimeMs) {
      setTimeout(() => {
        debug("Max runtime reached, closing worker");
        void (async () => {
          await traceChecksWorker.close();
          await topicClusteringWorker.close();
          resolve(undefined);
        })();
      }, maxRuntimeMs);
    } else {
      resolve({ traceChecksWorker, topicClusteringWorker });
    }
  });
};
