import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 25;
}
export const pageArgs = (q: PageQuery) => ({ skip: ((q.page ?? 1) - 1) * (q.limit ?? 25), take: q.limit ?? 25 });
export const paged = <T>(items: T[], total: number, q: PageQuery) => ({ items, total, page: q.page ?? 1, limit: q.limit ?? 25 });
