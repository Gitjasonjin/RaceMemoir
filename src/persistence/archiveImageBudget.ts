import type {CollectionRecord} from '../domain/records.ts'
import {ImageImportBudget} from '../shared/imageBudget.ts'

/** Validate every image before returning a backup to storage or rendering.
 * Use raster headers, never dimensions supplied by the manifest. No decoder runs here.
 */
export async function validateArchiveImages(records:CollectionRecord[]){
  const budget=new ImageImportBudget()
  for(const record of records){
    if(record.kind==='route')continue
    if(record.image)await budget.reserve(record.image)
    if(record.kind!=='photo'&&record.originalImage)await budget.reserve(record.originalImage)
  }
}
