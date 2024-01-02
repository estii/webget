type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type Nullable<T extends { nullable: false; default: any }> = Omit<
  T,
  "default" | "nullable"
> & {
  nullable: true;
  default: T["default"] | null;
};

type BaseField = {
  id: string;
};

type StringField = Prettify<
  BaseField & {
    type: "string";
    nullable: false;
    default: string;
  }
>;

type NullableStringField = Prettify<Nullable<StringField>>;

type NumberField = Prettify<
  BaseField & {
    type: "number";
    nullable: false;
    default: number;
  }
>;

type NullableNumberField = Prettify<Nullable<NumberField>>;

type BooleanField = Prettify<
  BaseField & {
    type: "boolean";
    nullable: false;
    default: boolean;
  }
>;

type NullableBooleanField = Prettify<Nullable<BooleanField>>;

// type RelationField = Prettify<
//   BaseField & { type: "one" | "many"; entity: Entity }
// >;

export type Field =
  | StringField
  | NullableStringField
  | NumberField
  | NullableNumberField
  | BooleanField
  | NullableBooleanField;
// | RelationField;

export type EntityData<T extends Record<string, Field>> = Prettify<{
  [K in keyof T]: T[K]["type"] extends "string"
    ? T[K]["nullable"] extends true
      ? string | null
      : string
    : T[K]["type"] extends "number"
    ? number
    : T[K]["type"] extends "boolean"
    ? boolean
    : never;
}>;

type Entity = {
  id: string;
  name: string;
  fields: Record<string, Field>;
};

function entity<T extends Entity>(params: T) {
  const get = async (id: string): Promise<EntityData<T["fields"]> | null> => {
    return null;
  };

  return { params, get };
}

function field<T extends Field>(field: T): T {
  return field;
}

// function many(entity: () => Entity) {
//   return field({
//     id: "friends",
//     name: "friends",
//     type: "many",
//     entity: entity(),
//   });
// }

export const user = entity({
  id: "user",
  name: "user",
  fields: {
    id: field({
      id: "id",
      type: "string",
      nullable: false,
      default: "user_<uuid>",
    }),
    name: field({
      id: "name",
      type: "string",
      default: "",
      nullable: true,
    }),
    email: field({
      id: "email",
      type: "string",
      default: null,
      nullable: true,
    }),
    age: field({
      id: "age",
      name: "age",
      type: "number",
      default: 0,
      nullable: false,
    }),
  },
});

user.get("user_1234").then((user) => {});
// export const userGraph:Graph<{friends:}> = graph(user, {
//   friends: many(() => userGraph),
// });
