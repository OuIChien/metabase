import _ from "underscore";

import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import {
  describeWithSnowplow,
  enterCustomColumnDetails,
  getNotebookStep,
  openNotebook,
  openOrdersTable,
  popover,
  restore,
  visualize,
  createQuestion,
} from "e2e/support/helpers";

const { PEOPLE, PEOPLE_ID } = SAMPLE_DATABASE;

const DATE_CASES = [
  {
    option: "Hour of day",
    value: "21",
    example: "0, 1",
  },
  {
    option: "Day of month",
    value: "11",
    example: "1, 2",
  },
  {
    option: "Day of week",
    value: "Tuesday",
    example: "Monday, Tuesday",
  },
  {
    option: "Month of year",
    value: "Feb",
    example: "Jan, Feb",
  },
  {
    option: "Quarter of year",
    value: "Q1",
    example: "Q1, Q2",
  },
  {
    option: "Year",
    value: "2,025",
    example: "2023, 2024",
  },
];

const EMAIL_CASES = [
  {
    option: "Domain",
    value: "yahoo",
    example: "example, online",
  },
  {
    option: "Host",
    value: "yahoo.com",
    example: "example.com, online.com",
  },
];

const URL_CASES = [
  {
    option: "Domain",
    value: "yahoo",
    example: "example, online",
  },
  {
    option: "Subdomain",
    value: "",
    example: "www, maps",
  },
  {
    option: "Host",
    value: "yahoo.com",
    example: "example.com, online.com",
  },
];

describeWithSnowplow("extract shortcut", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  describe("date columns", () => {
    describe("should add a date expression for each option", () => {
      DATE_CASES.forEach(({ option, value, example }) => {
        it(option, () => {
          openOrdersTable({ limit: 1 });
          extractColumnAndCheck({
            column: "Created At",
            option,
            value,
            example,
          });
        });
      });
    });

    it("should handle duplicate expression names", () => {
      openOrdersTable({ limit: 1 });
      extractColumnAndCheck({
        column: "Created At",
        option: "Hour of day",
        newColumn: "Hour of day",
      });
      extractColumnAndCheck({
        column: "Created At",
        option: "Hour of day",
        newColumn: "Hour of day_2",
      });
    });

    it("should be able to modify the expression in the notebook editor", () => {
      openOrdersTable({ limit: 1 });
      extractColumnAndCheck({
        column: "Created At",
        option: "Year",
        value: "2,025",
      });
      openNotebook();
      getNotebookStep("expression").findByText("Year").click();
      enterCustomColumnDetails({ name: "custom formula", formula: "+ 2" });
      popover().button("Update").click();
      visualize();
      cy.findByRole("gridcell", { name: "2,027" }).should("be.visible");
    });
  });

  describe("email columns", () => {
    beforeEach(() => {
      restore();
      cy.signInAsAdmin();
    });

    EMAIL_CASES.forEach(({ option, value, example }) => {
      it(option, () => {
        createQuestion(
          {
            query: {
              "source-table": PEOPLE_ID,
              limit: 1,
              fields: [["field", PEOPLE.EMAIL, null]],
            },
          },
          {
            visitQuestion: true,
          },
        );

        extractColumnAndCheck({
          column: "Email",
          option,
          value,
          example,
        });
      });
    });
  });

  describe("url columns", () => {
    beforeEach(() => {
      restore();
      cy.signInAsAdmin();

      // Make the Email column a URL column for these tests, to avoid having to create a new model
      cy.request("PUT", `/api/field/${PEOPLE.EMAIL}`, {
        semantic_type: "type/URL",
      });
    });

    URL_CASES.forEach(({ option, value, example }) => {
      it(option, () => {
        createQuestion(
          {
            query: {
              "source-table": PEOPLE_ID,
              limit: 1,
              fields: [["field", PEOPLE.EMAIL, { "base-type": "type/String" }]],
            },
          },
          {
            visitQuestion: true,
          },
        );

        extractColumnAndCheck({
          column: "Email",
          option,
          value,
          example,
        });
      });
    });
  });
});

function extractColumnAndCheck({
  column,
  option,
  newColumn = option,
  value,
  example,
}: {
  column: string;
  option: string;
  value?: string;
  example?: string;
  newColumn?: string;
}) {
  const requestAlias = _.uniqueId("dataset");
  cy.intercept("POST", "/api/dataset").as(requestAlias);
  cy.findByLabelText("Add column").click();

  popover().findByText("Extract part of column").click();
  popover().findAllByText(column).first().click();

  if (example) {
    popover().findByText(option).parent().should("contain", example);
  }

  popover().findByText(option).click();

  cy.wait(`@${requestAlias}`);

  cy.findByRole("columnheader", { name: newColumn }).should("be.visible");
  if (value) {
    cy.findByRole("gridcell", { name: value }).should("be.visible");
  }
}
