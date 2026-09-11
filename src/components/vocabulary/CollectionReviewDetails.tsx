"use client";

import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import type { VocabularyCollectionItem } from "@lib/client-api";

export function reviewDate(value: string | null | undefined, locale: "en" | "zh") {
  return value ? new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function CollectionReviewDetails({ item, locale }: { item: VocabularyCollectionItem; locale: "en" | "zh" }) {
  const zh = locale === "zh", review = item.review;
  const correct = item.correctCount || 0, wrong = item.wrongCount || 0;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const metric = (label: string, value: string, hint?: string) => <Box key={label} sx={{ minWidth: 0 }}><Typography component="dt" variant="caption" color="text.secondary">{label}</Typography><Tooltip title={hint || ""}><Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>{value}</Typography></Tooltip></Box>;
  return <Stack spacing={1} sx={{ mt: 1.25 }}>
    <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {review && <Chip size="small" color={review.status === "due" ? "warning" : review.status === "new" ? "info" : "default"} label={review.status === "due" ? (zh ? "待复习" : "Due for review") : review.status === "new" ? (zh ? "尚未作答" : "Not reviewed") : (zh ? "未到复习时间" : "Scheduled")} />}
      <Chip size="small" color="success" variant="outlined" label={`${zh ? "正确" : "Correct"} ${correct}`} />
      <Chip size="small" color="error" variant="outlined" label={`${zh ? "错误" : "Wrong"} ${wrong}`} />
      <Chip size="small" variant="outlined" label={`${zh ? "展示" : "Seen"} ${item.appearanceCount || 0}`} />
      <Chip size="small" variant="outlined" label={`${zh ? "正确率" : "Accuracy"} ${correct + wrong ? percent(correct / (correct + wrong)) : "—"}`} />
    </Stack>
    {review && <>
      <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1, m: 0 }}>
        {metric(zh ? "上次复习" : "Last reviewed", review.lastReviewedAt ? reviewDate(review.lastReviewedAt, locale) : (correct + wrong ? (zh ? "旧记录未保存时间" : "Time unavailable in legacy data") : (zh ? "尚未作答" : "Not reviewed")))}
        {metric(zh ? "下次建议复习" : "Next suggested review", review.dueAt ? reviewDate(review.dueAt, locale) : (zh ? "等待首次学习" : "Awaiting first review"))}
      </Box>
      <Box component="details" sx={{ "& summary": { cursor: "pointer", color: "primary.main", fontSize: 13, py: .5 }, "& summary:focus-visible": { outline: "2px solid", outlineColor: "primary.main", borderRadius: 1 } }}>
        <Box component="summary">{zh ? "记忆数据与说明" : "Memory data and explanation"}</Box>
        <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25, my: 1 }}>
          {metric(zh ? "预计记得的概率" : "Estimated recall", review.recallProbability === null ? "—" : percent(review.recallProbability))}
          {metric(zh ? "记忆稳定性" : "Memory stability", review.stabilityDays === null ? "—" : `${review.stabilityDays.toFixed(1)} ${zh ? "天" : "days"}`)}
          {metric(zh ? "单词难度" : "Word difficulty", review.difficulty === null ? "—" : `${review.difficulty.toFixed(1)} / 10`)}
          {metric(zh ? "遗忘回退次数" : "Lapses", review.lapses === null ? "—" : String(review.lapses))}
          {metric(zh ? "加入收藏时间" : "Added to collection", reviewDate(review.addedAt, locale))}
          {metric(zh ? "估计时间" : "Estimated at", reviewDate(review.calculatedAt, locale))}
        </Box>
        <Typography variant="caption" color="text.secondary" component="p">{zh ? "正确／错误来自已同步作答；展示次数不代表答对。记忆概率、稳定性和难度由 FSRS 估计，并非实际正确率。稳定性表示预计记忆保持率降至约 90% 所需的天数；难度越高越难记住。遗忘回退指已进入复习阶段后再次忘记，与累计错误次数不同。" : "Correct and wrong counts reflect synced answers; seeing a word is not a correct answer. FSRS estimates recall, stability and difficulty. Stability is the time in days for predicted recall to fall to about 90%; higher difficulty means harder to remember. Lapses count forgetting after reaching the review stage, rather than all wrong answers."}</Typography>
        {review.estimated && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: .75 }}>{zh ? "历史数据缺少完整作答时间，上述记忆指标为保守初始估计；后续将随真实复习记录更新。" : "Legacy data lacks a complete review timeline. These are conservative initial estimates that will update with new reviews."}</Typography>}
      </Box>
    </>}
  </Stack>;
}
