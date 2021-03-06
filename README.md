# Aerine

## Aerine is an attempt to create a new web framework from first principles

### Vision

* Take data-driven development as far as reasonably possible
* Optimize for developer experience
* Provide a complete out of the box solution (full stack, vertically integrated)
* Continue the great tradition of convention over configuration

### Warning

This framework is experimental.

### FAQ

Q. Is it ready yet?

A. Getting there

Q. What can it do so far?

A. Automatic runtime database migration, with optional destructive table re-creation

A. Built-in end-to-end CRUD operations based only on HTML5 forms and data type definitions

A. Automatic data query deduction from template expressions (up to one relational join)

A. Integrated user creation and authentication

Q. What burning issues are there?

A. The query engine supports as many database queries as there are tables in one HTTP request. For large applications this may leave it open to DOS attacks.
