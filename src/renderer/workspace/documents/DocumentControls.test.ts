import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CreateDocumentControl,
  RenameTitleForm,
} from "./DocumentControls";

describe("RenameTitleForm", () => {
  it("keeps the enabled title form contract without trimming its displayed value", () => {
    const markup = renderToStaticMarkup(createElement(RenameTitleForm, {
      itemLabel: "작품",
      onCancel: vi.fn(),
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      submitting: false,
      value: "  별의 기록  ",
    }));

    expect(markup).toContain('aria-label="작품 이름 변경"');
    expect(markup).toContain('class="title-rename-form"');
    expect(markup).toContain('aria-label="작품 새 이름"');
    expect(markup).toContain('autofocus=""');
    expect(markup).toContain('value="  별의 기록  "');
    expect(markup).toContain('<button type="button">취소</button>');
    expect(markup).toContain('<button type="submit">저장</button>');
  });

  it("keeps whitespace and submitting states disabled", () => {
    const whitespaceMarkup = renderToStaticMarkup(createElement(
      RenameTitleForm,
      {
        itemLabel: "회차",
        onCancel: vi.fn(),
        onChange: vi.fn(),
        onSubmit: vi.fn(),
        submitting: false,
        value: "   ",
      },
    ));
    const submittingMarkup = renderToStaticMarkup(createElement(
      RenameTitleForm,
      {
        itemLabel: "회차",
        onCancel: vi.fn(),
        onChange: vi.fn(),
        onSubmit: vi.fn(),
        submitting: true,
        value: "1회차",
      },
    ));

    expect(whitespaceMarkup).toContain('aria-label="회차 이름 변경"');
    expect(whitespaceMarkup).toContain(
      '<button disabled="" type="submit">저장</button>',
    );
    expect(submittingMarkup).toContain(
      'aria-label="회차 새 이름" autofocus="" disabled=""',
    );
    expect(submittingMarkup).toContain(
      '<button disabled="" type="button">취소</button>',
    );
    expect(submittingMarkup).toContain(
      '<button disabled="" type="submit">저장 중</button>',
    );
  });
});

describe("CreateDocumentControl", () => {
  it("keeps the enabled new-document button contract", () => {
    const markup = renderToStaticMarkup(createElement(CreateDocumentControl, {
      disabled: false,
      onCreate: vi.fn(),
    }));

    expect(markup).toContain('class="create-document-control"');
    expect(markup).toContain('aria-label="새 회차"');
    expect(markup).toContain('class="create-document-button"');
    expect(markup).toContain('title="새 회차"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it("keeps the disabled new-document button contract", () => {
    const markup = renderToStaticMarkup(createElement(CreateDocumentControl, {
      disabled: true,
      onCreate: vi.fn(),
    }));

    expect(markup).toContain(
      'aria-label="새 회차" class="create-document-button" disabled=""',
    );
  });
});
