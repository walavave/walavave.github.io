---
title: Markdown Smoke Fixture
---

# Markdown Smoke Fixture

## Callout

:::tip[一个小建议]
这里是 smoke fixture 的 callout 内容。
:::

## Code Block

```js
export const smoke = 'ok';
console.log(smoke);
```

## Math

Inline math $$x + y$$ should render as KaTeX.

$$
x^2 + y^2 = z^2
$$

## Figure

<figure class="figure figure--md figure--left">
  <picture>
    <source srcset="/images/archive/demo-archive-03.webp" type="image/webp" />
    <img src="/images/archive/demo-archive-02.webp" alt="Smoke fixture standalone figure" />
  </picture>
  <figcaption class="figure-caption">Smoke fixture standalone figure</figcaption>
</figure>

## Gallery

<ul class="gallery cols-2">
  <li>
    <figure>
      <img src="/images/archive/demo-archive-01.webp" alt="Smoke fixture gallery item 1" />
      <figcaption>Smoke fixture gallery item 1</figcaption>
    </figure>
  </li>
  <li>
    <figure>
      <img src="/images/archive/demo-archive-02.webp" alt="Smoke fixture gallery item 2" />
    </figure>
  </li>
</ul>

## Link Cards

::link-card[一个 B 站视频]{url="https://www.bilibili.com/video/BV1xx411c7mD" description="链接卡片 smoke fixture"}

::link-card[知乎文章]{url="https://zhuanlan.zhihu.com/p/123456789"}
