import { resolve } from 'node:path';
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
export const embeddingModel = 'Xenova/all-MiniLM-L6-v2';
// Public model weights are cached locally. Service text and queries are never sent to a model API.
env.cacheDir = resolve(process.cwd(), '.tools/semantic-models');
let extractor: Promise<FeatureExtractionPipeline> | undefined;
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const createExtractor = pipeline as unknown as (task: 'feature-extraction', model: string, options: {dtype:'q8';device:'cpu'}) => Promise<FeatureExtractionPipeline>;
  extractor ??= createExtractor('feature-extraction', embeddingModel, {dtype:'q8', device:'cpu'});
  try {
    const model = await extractor;
    const output = await model(texts,{pooling:'mean',normalize:true});
    return output.tolist() as number[][];
  } catch (error) { extractor = undefined; throw error; }
}
